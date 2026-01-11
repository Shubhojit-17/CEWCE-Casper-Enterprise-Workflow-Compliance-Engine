// =============================================================================
// Workflow Detail Page
// =============================================================================

import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
  ClockIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import {
  formatDateTime,
  formatRelativeTime,
  getStateName,
  getStateColor,
  getStatusColor,
  truncateHash,
  copyToClipboard,
} from '../../lib/utils';
import { useWalletStore } from '../../stores/wallet';
import type { WorkflowInstance } from '../../types';

interface AvailableTransition {
  name: string;
  fromState: number;
  toState: number;
  toStateName: string;
  requiredRoles: string[];
}

interface WorkflowDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  checksum: string;
  createdAt: string;
}

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isConnected, publicKey } = useWalletStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<AvailableTransition | null>(null);
  const [comment, setComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');

  // Check for valid ID - must exist and not be "undefined" string
  const isValidId = Boolean(id && id !== 'undefined');

  // Fetch workflow instance with auto-refresh for pending states
  const { data: workflow, isLoading: workflowLoading, error: workflowError } = useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const response = await api.get<{ data: WorkflowInstance }>(
        `/workflow-instances/${id}`
      );
      return response.data.data;
    },
    enabled: isValidId,
    retry: false,
    // Auto-refetch every 3 seconds if there are pending transitions
    refetchInterval: (query) => {
      const data = query.state.data as WorkflowInstance | undefined;
      const hasPendingTransitions = data?.transitions?.some(
        (t: { status: string }) => t.status === 'PENDING' || t.status === 'ONCHAIN_PENDING'
      );
      return hasPendingTransitions ? 3000 : false;
    },
  });

  // Check if there are any pending transitions (block new actions)
  const hasPendingTransition = workflow?.transitions?.some(
    (t: { status: string }) => t.status === 'PENDING' || t.status === 'ONCHAIN_PENDING'
  );

  // Check if workflow is completed
  const isWorkflowCompleted = workflow?.status === 'COMPLETED';

  // Fetch available transitions - skip if workflow is completed
  const { data: availableTransitions = [] } = useQuery<AvailableTransition[]>({
    queryKey: ['workflow-transitions', id],
    queryFn: async () => {
      const response = await api.get<{ data: { transitions: AvailableTransition[] } }>(
        `/workflow-instances/${id}/available-transitions`
      );
      return response.data.data.transitions || [];
    },
    enabled: isValidId && !!workflow && !isWorkflowCompleted,
    retry: false,
    // Refetch when workflow data changes
    refetchInterval: () => {
      return hasPendingTransition ? 3000 : false;
    },
  });

  // Fetch documents
  const { data: documents = [] } = useQuery<WorkflowDocument[]>({
    queryKey: ['workflow-documents', id],
    queryFn: async () => {
      const response = await api.get<{ data: { documents: WorkflowDocument[] } }>(
        `/workflow-instances/${id}/documents`
      );
      return response.data.data.documents || [];
    },
    enabled: isValidId && !!workflow,
    retry: false,
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const content = await fileToBase64(file);
      const response = await api.post(`/workflow-instances/${id}/documents`, {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        content,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['workflow-documents', id] });
    },
    onError: () => {
      toast.error('Failed to upload document');
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await api.delete(`/workflow-instances/${id}/documents/${documentId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['workflow-documents', id] });
    },
    onError: () => {
      toast.error('Failed to delete document');
    },
  });

  // Transition mutation - creates transition, signs with wallet, and submits
  const transitionMutation = useMutation({
    mutationFn: async (data: { action: string; toState: number; comment?: string }) => {
      // Step 1: Create transition and get unsigned deploy
      const response = await api.post(`/workflow-instances/${id}/transition`, data);
      const { transitionId, deploy, message } = response.data.data;
      
      // If no deploy (off-chain only), we're done
      if (!deploy) {
        return { offChain: true, message };
      }
      
      // Step 2: Sign the deploy with wallet
      const { signDeploy } = useWalletStore.getState();
      let signedDeploy;
      try {
        signedDeploy = await signDeploy(deploy);
      } catch (signError) {
        // If user rejects signing, we should cancel the pending transition
        console.error('Wallet signing cancelled or failed:', signError);
        throw new Error('Wallet signing was cancelled or failed. Please try again.');
      }
      
      // Step 3: Submit signed deploy to backend
      const submitResponse = await api.post(`/workflow-instances/${id}/transition/submit`, {
        transitionId,
        signedDeploy,
      });
      
      return submitResponse.data;
    },
    onSuccess: (data) => {
      if (data?.offChain) {
        toast.success('Transition recorded (off-chain)');
      } else {
        toast.success('Transition submitted to blockchain');
      }
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      queryClient.invalidateQueries({ queryKey: ['workflow-transitions', id] });
      setIsTransitionModalOpen(false);
      setSelectedTransition(null);
      setComment('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit transition');
    },
  });

  // Approve workflow mutation (approver only - triggers blockchain registration)
  const approveWorkflowMutation = useMutation({
    mutationFn: async (comment: string) => {
      const response = await api.post(`/workflow-instances/${id}/transition`, {
        toState: 10, // Approved state
        comment,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Workflow approved! Submitting to blockchain...');
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve workflow');
    },
  });

  // Reject workflow mutation (approver only - stays off-chain)
  const rejectWorkflowMutation = useMutation({
    mutationFn: async (comment: string) => {
      const response = await api.post(`/workflow-instances/${id}/transition`, {
        toState: 11, // Rejected state
        comment,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Workflow rejected. Requester can make changes and resubmit.');
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject workflow');
    },
  });

  // Resubmit workflow mutation (for rejected off-chain workflows)
  const resubmitWorkflowMutation = useMutation({
    mutationFn: async (comment: string) => {
      const response = await api.post(`/workflow-instances/${id}/resubmit`, {
        comment,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Workflow resubmitted for approver review.');
      setApprovalComment('');
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resubmit workflow');
    },
  });

  // Cancel pending transition mutation
  const cancelTransitionMutation = useMutation({
    mutationFn: async (transitionId: string) => {
      const response = await api.post(`/workflow-instances/${id}/transition/${transitionId}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Transition cancelled');
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      queryClient.invalidateQueries({ queryKey: ['workflow-transitions', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel transition');
    },
  });

  const handleTransition = (transition: AvailableTransition) => {
    if (!isConnected) {
      toast.error('Please connect your Casper Wallet first');
      navigate('/wallet');
      return;
    }
    setSelectedTransition(transition);
    setIsTransitionModalOpen(true);
  };

  const submitTransition = () => {
    if (!selectedTransition) return;
    transitionMutation.mutate({
      action: selectedTransition.name,
      toState: selectedTransition.toState,
      comment: comment || undefined,
    });
  };

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle document download
  const handleDownload = async (doc: WorkflowDocument) => {
    try {
      const response = await api.get<{ data: { document: WorkflowDocument & { content: string } } }>(
        `/workflow-instances/${id}/documents/${doc.id}`
      );
      const content = response.data.data.document.content;
      
      // Convert base64 to blob
      const byteCharacters = atob(content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: doc.mimeType });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (!isValidId) {
    return (
      <div className="space-y-6">
        <div className="card p-6 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Invalid Workflow ID</h2>
          <p className="text-sm text-gray-500 mb-4">The workflow ID is invalid or missing.</p>
          <button onClick={() => navigate('/workflows')} className="btn btn-primary">
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  if (workflowLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
      </div>
    );
  }

  if (workflowError || !workflow) {
    return (
      <div className="space-y-6">
        <div className="card p-6 text-center">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Workflow Not Found</h2>
          <p className="text-sm text-gray-500 mb-4">The requested workflow could not be found.</p>
          <button onClick={() => navigate('/workflows')} className="btn btn-primary">
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium text-gray-900">Workflow not found</h2>
        <Link to="/workflows" className="mt-4 text-enterprise-primary hover:underline">
          Back to workflows
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/workflows')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{workflow.title}</h1>
            {workflow.description && (
              <p className="mt-1 text-gray-500">{workflow.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={getStatusColor(workflow.status)}>{workflow.status}</span>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStateColor(
              workflow.currentState
            )}`}
          >
            {getStateName(workflow.currentState)}
          </span>
        </div>
      </div>

      {/* Legacy Template Warning */}
      {workflow.isLegacy && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Legacy Template</h3>
              <p className="mt-1 text-sm text-amber-700">
                {workflow.legacyMessage || 'This workflow uses a template created before blockchain enforcement. Transitions are disabled.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Actions - Only show for ACTIVE workflows that are on-chain and ready for transitions */}
          {availableTransitions && availableTransitions.length > 0 && 
           !workflow.isLegacy && 
           !isWorkflowCompleted && 
           workflow.isOnChain && 
           workflow.status === 'ACTIVE' && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-medium text-gray-900">Available Actions</h2>
              </div>
              <div className="card-body">
                {hasPendingTransition ? (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    <span>Waiting for pending transition to complete...</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {availableTransitions.map((transition) => (
                      <button
                        key={`${transition.name}-${transition.toState}`}
                        onClick={() => handleTransition(transition)}
                        disabled={transitionMutation.isPending}
                        className={
                          transition.name === 'approve'
                            ? 'btn-success'
                            : transition.name === 'reject'
                            ? 'btn-danger'
                            : 'btn-secondary'
                        }
                      >
                        {transition.name === 'approve' && (
                          <CheckCircleIcon className="h-5 w-5 mr-2" />
                        )}
                        {transition.name === 'reject' && (
                          <XCircleIcon className="h-5 w-5 mr-2" />
                        )}
                        {transition.name === 'escalate' && (
                          <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                        )}
                        {transitionMutation.isPending ? 'Processing...' : transition.name.charAt(0).toUpperCase() + transition.name.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Workflow Data */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Workflow Data</h2>
            </div>
            <div className="card-body">
              {workflow.data && Object.keys(workflow.data).length > 0 ? (
                <dl className="space-y-4">
                  {Object.entries(workflow.data).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-sm font-medium text-gray-500 capitalize">
                        {key.replace(/_/g, ' ')}
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {typeof value === 'object'
                          ? JSON.stringify(value, null, 2)
                          : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-gray-500">No additional data</p>
              )}
            </div>
          </div>

          {/* Transition History */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Transition History</h2>
            </div>
            <div className="card-body p-0">
              {workflow.transitions && workflow.transitions.length > 0 ? (
                <div className="flow-root">
                  <ul className="-mb-8">
                    {workflow.transitions.map((transition, idx) => (
                      <li key={transition.id}>
                        <div className="relative pb-8">
                          {idx !== workflow.transitions!.length - 1 && (
                            <span
                              className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                              aria-hidden="true"
                            />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span
                                className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                  // REJECT actions should always show red, even if status is CONFIRMED
                                  transition.action === 'REJECT'
                                    ? 'bg-red-500'
                                    : transition.status === 'CONFIRMED' || transition.status === 'CONFIRMED_ONCHAIN'
                                    ? 'bg-green-500'
                                    : transition.status === 'FAILED' || transition.status === 'FAILED_ONCHAIN'
                                    ? 'bg-red-500'
                                    : transition.status === 'PENDING' || transition.status === 'ONCHAIN_PENDING'
                                    ? 'bg-yellow-500'
                                    : 'bg-gray-500'
                                }`}
                              >
                                {/* REJECT actions should show X icon */}
                                {transition.action === 'REJECT' ? (
                                  <XCircleIcon className="h-5 w-5 text-white" />
                                ) : transition.status === 'CONFIRMED' || transition.status === 'CONFIRMED_ONCHAIN' ? (
                                  <CheckCircleIcon className="h-5 w-5 text-white" />
                                ) : transition.status === 'FAILED' || transition.status === 'FAILED_ONCHAIN' ? (
                                  <XCircleIcon className="h-5 w-5 text-white" />
                                ) : transition.status === 'PENDING' || transition.status === 'ONCHAIN_PENDING' ? (
                                  <ArrowPathIcon className="h-5 w-5 text-white animate-spin" />
                                ) : (
                                  <CheckCircleIcon className="h-5 w-5 text-white" />
                                )}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5">
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-900">
                                  <span className="font-medium capitalize">
                                    {transition.action}
                                  </span>
                                  <span className="text-gray-500">
                                    {' '}
                                    from {getStateName(transition.fromState)} to{' '}
                                    {getStateName(transition.toState)}
                                  </span>
                                </p>
                                {/* Show REJECTED for REJECT actions, otherwise show the actual status */}
                                <span className={transition.action === 'REJECT' ? 'text-sm font-medium text-red-600' : getStatusColor(transition.status)}>
                                  {transition.action === 'REJECT' ? 'REJECTED' : transition.status}
                                </span>
                              </div>
                              {transition.comment && (
                                <p className="mt-1 text-sm text-gray-500">
                                  {transition.comment}
                                </p>
                              )}
                              {transition.deployHash && (
                                <p className="mt-1 text-xs font-mono text-gray-400">
                                  <button
                                    onClick={() => {
                                      copyToClipboard(transition.deployHash!);
                                      toast.success('Deploy hash copied');
                                    }}
                                    className="hover:text-enterprise-primary"
                                  >
                                    {truncateHash(transition.deployHash)}
                                  </button>
                                </p>
                              )}
                              <div className="mt-1 flex items-center gap-3">
                                <p className="text-xs text-gray-400">
                                  {formatRelativeTime(transition.createdAt)}
                                </p>
                                {transition.status === 'PENDING' && (
                                  <button
                                    onClick={() => cancelTransitionMutation.mutate(transition.id)}
                                    disabled={cancelTransitionMutation.isPending}
                                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                                  >
                                    {cancelTransitionMutation.isPending ? 'Cancelling...' : 'Cancel'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  No transitions recorded
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Details</h2>
            </div>
            <div className="card-body">
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDateTime(workflow.createdAt)}
                  </dd>
                </div>
                {workflow.submittedAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Submitted</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDateTime(workflow.submittedAt)}
                    </dd>
                  </div>
                )}
                {workflow.dueDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" />
                      Due Date
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDateTime(workflow.dueDate)}
                    </dd>
                  </div>
                )}
                {workflow.completedAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Completed</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDateTime(workflow.completedAt)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Blockchain Info */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Blockchain</h2>
            </div>
            <div className="card-body">
              <dl className="space-y-4">
                {workflow.workflowId && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">On-chain ID</dt>
                    <dd className="mt-1 text-sm font-mono text-gray-900">
                      #{workflow.workflowId}
                    </dd>
                  </div>
                )}
                {workflow.deployHash && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Deploy Hash</dt>
                    <dd className="mt-1">
                      <a
                        href={`https://testnet.cspr.live/deploy/${workflow.deployHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-enterprise-primary hover:underline"
                      >
                        {truncateHash(workflow.deployHash)}
                      </a>
                    </dd>
                  </div>
                )}
                {workflow.status === 'ONCHAIN_PENDING' && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    <span>Awaiting blockchain confirmation...</span>
                  </div>
                )}
                {!workflow.workflowId && !workflow.deployHash && workflow.status !== 'ONCHAIN_PENDING' && workflow.status !== 'CUSTOMER_CONFIRMED' && (
                  <p className="text-sm text-gray-500">
                    Not yet submitted to blockchain
                  </p>
                )}
                {workflow.isPendingApproval && (
                  <p className="text-sm text-amber-600">
                    Awaiting approver review. Blockchain registration happens upon approval.
                  </p>
                )}
              </dl>
            </div>
          </div>

          {/* Approver Action Section - Only for approvers when workflow is pending approval */}
          {workflow.canApprove && (
            <div className="card border-2 border-amber-200 bg-amber-50">
              <div className="card-header bg-amber-100">
                <h2 className="text-lg font-medium text-amber-900 flex items-center gap-2">
                  <ExclamationCircleIcon className="h-5 w-5" />
                  Approval Required
                </h2>
              </div>
              <div className="card-body space-y-4">
                <p className="text-sm text-gray-700">
                  This workflow has been confirmed by the customer and is ready for your review.
                  Approving will register the workflow on the blockchain.
                </p>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Decision Comment (required for rejection)
                  </label>
                  <textarea
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-enterprise-primary/20"
                    rows={3}
                    placeholder="Enter your review comments..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => approveWorkflowMutation.mutate(approvalComment)}
                    disabled={approveWorkflowMutation.isPending || rejectWorkflowMutation.isPending}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    {approveWorkflowMutation.isPending ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5" />
                        Approve & Submit to Blockchain
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (!approvalComment.trim()) {
                        toast.error('Please provide a reason for rejection');
                        return;
                      }
                      rejectWorkflowMutation.mutate(approvalComment);
                    }}
                    disabled={approveWorkflowMutation.isPending || rejectWorkflowMutation.isPending}
                    className="flex-1 btn-secondary bg-red-50 text-red-700 border-red-300 hover:bg-red-100 flex items-center justify-center gap-2"
                  >
                    {rejectWorkflowMutation.isPending ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Rejecting...
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="h-5 w-5" />
                        Reject
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Resubmit Section - For rejected off-chain workflows, shown to creator/requester or assigned customer */}
          {workflow.canResubmit && (
            <div className="card border-2 border-blue-200 bg-blue-50">
              <div className="card-header bg-blue-100">
                <h2 className="text-lg font-medium text-blue-900 flex items-center gap-2">
                  <ArrowPathIcon className="h-5 w-5" />
                  Resubmit for Approval
                </h2>
              </div>
              <div className="card-body space-y-4">
                <p className="text-sm text-gray-700">
                  This workflow was rejected. You can upload additional documents and resubmit it for approval.
                </p>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resubmission Comment (optional)
                  </label>
                  <textarea
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-enterprise-primary/20"
                    rows={3}
                    placeholder="Describe what changes you've made..."
                  />
                </div>

                <button
                  onClick={() => resubmitWorkflowMutation.mutate(approvalComment)}
                  disabled={resubmitWorkflowMutation.isPending}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  {resubmitWorkflowMutation.isPending ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      Resubmitting...
                    </>
                  ) : (
                    <>
                      <ArrowPathIcon className="h-5 w-5" />
                      Resubmit for Approval
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Documents</h2>
              {/* Only show upload button for off-chain workflows or rejected workflows */}
              {(!workflow.isOnChain || workflow.status === 'REJECTED') && (
                <label className="text-sm text-enterprise-primary hover:underline cursor-pointer flex items-center gap-1">
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Upload'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>
              )}
            </div>
            <div className="card-body">
              {documents && documents.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {documents.map((doc) => (
                    <li key={doc.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(doc.size)} • {formatRelativeTime(doc.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-1 text-gray-400 hover:text-enterprise-primary"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                        {/* Only show delete button for off-chain workflows (not yet registered on blockchain) */}
                        {!workflow?.isOnChain && (
                          <button
                            onClick={() => {
                              if (confirm('Delete this document?')) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-500"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <DocumentTextIcon className="h-8 w-8 mx-auto text-gray-400" />
                  <p className="mt-2 text-sm">No documents attached</p>
                  <p className="text-xs text-gray-400 mt-1">Click Upload to add documents</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transition Modal */}
      <Transition appear show={isTransitionModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsTransitionModalOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Confirm Transition: {selectedTransition?.name && (selectedTransition.name.charAt(0).toUpperCase() + selectedTransition.name.slice(1))}
                  </Dialog.Title>
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">
                      This action will be recorded on the Casper blockchain and cannot
                      be undone. Your wallet will be prompted to sign the transaction.
                    </p>
                    <div className="mt-4">
                      <label htmlFor="comment" className="label">
                        Comment (optional)
                      </label>
                      <textarea
                        id="comment"
                        rows={3}
                        className="input"
                        placeholder="Add a comment for this transition..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                    </div>
                    {!isConnected && (
                      <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          Wallet not connected. Using:{' '}
                          <span className="font-mono">{truncateHash(publicKey || '')}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      onClick={() => setIsTransitionModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`flex-1 ${
                        selectedTransition?.name === 'reject'
                          ? 'btn-danger'
                          : 'btn-primary'
                      }`}
                      onClick={submitTransition}
                      disabled={transitionMutation.isPending}
                    >
                      {transitionMutation.isPending ? 'Submitting...' : 'Confirm'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
