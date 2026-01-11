// =============================================================================
// Templates Page
// =============================================================================

import { useState, Fragment, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { WorkflowTemplate, TemplateStatus } from '../../types';

interface CreateTemplateForm {
  name: string;
  description: string;
  slaDays: number;
  escalationDays: number;
}

const DEFAULT_STATES = [
  { id: 0, name: 'Draft', isInitial: true, isTerminal: false },
  { id: 1, name: 'Pending Review', isInitial: false, isTerminal: false },
  { id: 10, name: 'Approved', isInitial: false, isTerminal: true },
  { id: 11, name: 'Rejected', isInitial: false, isTerminal: true },
  { id: 20, name: 'Escalated', isInitial: false, isTerminal: false },
  { id: 30, name: 'Cancelled', isInitial: false, isTerminal: true },
];

const DEFAULT_TRANSITIONS = [
  { from: 0, to: 1, action: 'submit', label: 'Submit for Review' },
  { from: 1, to: 10, action: 'approve', label: 'Approve' },
  { from: 1, to: 11, action: 'reject', label: 'Reject' },
  { from: 1, to: 20, action: 'escalate', label: 'Escalate' },
  { from: 20, to: 10, action: 'approve', label: 'Approve' },
  { from: 20, to: 11, action: 'reject', label: 'Reject' },
  { from: 0, to: 30, action: 'cancel', label: 'Cancel' },
  { from: 1, to: 30, action: 'cancel', label: 'Cancel' },
];

export function TemplatesPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [publishingTemplateId, setPublishingTemplateId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTemplateForm>();

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<CreateTemplateForm>();

  // Fetch templates with automatic polling when pending confirmations exist
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await api.get<{ data: { workflows: WorkflowTemplate[] } }>('/workflows');
      return response.data.data.workflows || [];
    },
    // Poll every 3 seconds when there are pending templates
    refetchInterval: (query) => {
      const data = query.state.data as WorkflowTemplate[] | undefined;
      if (!data) return false;
      const hasPending = data.some(t => t.registrationDeployHash && !t.onChainWorkflowId);
      return hasPending ? 3000 : false;
    },
  });

  // Check if any templates are pending blockchain confirmation
  const hasPendingTemplates = useMemo(() => {
    return templates.some(t => t.registrationDeployHash && !t.onChainWorkflowId);
  }, [templates]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateTemplateForm) => {
      const response = await api.post('/workflows', {
        ...data,
        states: DEFAULT_STATES,
        transitions: DEFAULT_TRANSITIONS,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Template created successfully');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsCreateModalOpen(false);
      reset();
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const errorMessage = axiosError.response?.data?.error?.message || 'Failed to create template';
      const errorCode = axiosError.response?.data?.error?.code;
      
      if (errorCode === 'DUPLICATE_ENTRY') {
        toast.error('A template with this name already exists');
      } else {
        toast.error(errorMessage);
      }
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      setPublishingTemplateId(id);
      const response = await api.patch(`/workflows/${id}`, {
        status: 'PUBLISHED' as TemplateStatus,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Check if we got an onChainWorkflowId (immediate confirmation) or just a deployHash (pending)
      const template = data?.data;
      if (template?.onChainWorkflowId) {
        toast.success('Template published successfully!');
      } else if (template?.registrationDeployHash) {
        toast.success('Deploy submitted! Template will be published once confirmed on-chain.');
      } else {
        toast.success('Template updated');
      }
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setPublishingTemplateId(null);
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: { message?: string } } } };
      const errorMessage = axiosError.response?.data?.error?.message || 'Failed to publish template';
      toast.error(errorMessage);
      setPublishingTemplateId(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/workflows/${id}`);
    },
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: () => {
      toast.error('Failed to delete template');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTemplateForm> }) => {
      const response = await api.patch(`/workflows/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Template updated');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsEditModalOpen(false);
      setEditingTemplate(null);
      resetEdit();
    },
    onError: () => {
      toast.error('Failed to update template');
    },
  });

  const onSubmit = (data: CreateTemplateForm) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: CreateTemplateForm) => {
    if (!editingTemplate) return;
    updateMutation.mutate({ id: editingTemplate.id, data });
  };

  const openEditModal = (template: WorkflowTemplate) => {
    setEditingTemplate(template);
    resetEdit({
      name: template.name,
      description: template.description || '',
      slaDays: template.slaDays || 7,
      escalationDays: template.escalationDays || 14,
    });
    setIsEditModalOpen(true);
  };

  const getStatusBadge = (status: TemplateStatus) => {
    const classes: Record<TemplateStatus, string> = {
      DRAFT: 'badge-neutral',
      PUBLISHED: 'badge-success',
      DEPRECATED: 'badge-warning',
      ARCHIVED: 'badge-danger',
    };
    return classes[status] || 'badge-neutral';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Define and manage workflow templates
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn-primary"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          New Template
        </button>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="card">
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {template.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={getStatusBadge(template.status)}>
                        {template.status}
                      </span>
                      {template.isLegacy && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          Legacy
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">
                    v{template.version}
                  </span>
                </div>
                {template.isLegacy && (
                  <p className="mt-2 text-xs text-amber-600">
                    Not registered on blockchain. Must be republished.
                  </p>
                )}
                {template.description && (
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                    {template.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                  <span>{template.states?.length || 0} states</span>
                  <span>•</span>
                  <span>SLA: {template.slaDays || 7}d</span>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  Created {formatDate(template.createdAt)}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
                  {template.status === 'DRAFT' && !template.registrationDeployHash && (
                    <>
                      <button
                        onClick={() => publishMutation.mutate(template.id)}
                        disabled={publishingTemplateId === template.id}
                        className="btn-success btn-sm flex-1"
                      >
                        {publishingTemplateId === template.id ? 'Submitting...' : 'Publish'}
                      </button>
                      <button 
                        onClick={() => openEditModal(template)}
                        className="btn-secondary btn-sm"
                        title="Edit template"
                        disabled={publishingTemplateId === template.id}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this template?')) {
                            deleteMutation.mutate(template.id);
                          }
                        }}
                        className="btn-danger btn-sm"
                        disabled={publishingTemplateId === template.id}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {template.registrationDeployHash && !template.onChainWorkflowId && (
                    <div className="flex items-center gap-2 text-sm text-yellow-600">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Confirming on blockchain...</span>
                    </div>
                  )}
                  {template.status === 'PUBLISHED' && template.onChainWorkflowId && (
                    <span className="text-sm text-green-600">
                      Active - used for new workflows
                    </span>
                  )}
                  {template.isLegacy && !template.registrationDeployHash && (
                    <button
                      onClick={() => publishMutation.mutate(template.id)}
                      disabled={publishingTemplateId === template.id}
                      className="btn-warning btn-sm flex-1"
                    >
                      {publishingTemplateId === template.id ? 'Registering...' : 'Register on Blockchain'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="card-body text-center py-12">
            <p className="text-gray-500">No templates yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first template to get started.
            </p>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Transition appear show={isCreateModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsCreateModalOpen(false)}
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
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium text-gray-900"
                  >
                    Create New Template
                  </Dialog.Title>

                  <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
                    <div>
                      <label htmlFor="name" className="label">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="name"
                        type="text"
                        className="input"
                        placeholder="e.g., Document Approval"
                        {...register('name', { required: 'Name is required' })}
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.name.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="description" className="label">
                        Description
                      </label>
                      <textarea
                        id="description"
                        rows={3}
                        className="input"
                        placeholder="Describe the workflow purpose..."
                        {...register('description')}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="slaDays" className="label">
                          SLA (days)
                        </label>
                        <input
                          id="slaDays"
                          type="number"
                          min="1"
                          defaultValue={7}
                          className="input"
                          {...register('slaDays', {
                            required: true,
                            valueAsNumber: true,
                            min: 1,
                          })}
                        />
                      </div>
                      <div>
                        <label htmlFor="escalationDays" className="label">
                          Escalation (days)
                        </label>
                        <input
                          id="escalationDays"
                          type="number"
                          min="1"
                          defaultValue={14}
                          className="input"
                          {...register('escalationDays', {
                            required: true,
                            valueAsNumber: true,
                            min: 1,
                          })}
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900">
                        Default States
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        This template will include the standard workflow states:
                        Draft → Pending Review → Approved/Rejected
                      </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        className="btn-secondary flex-1"
                        onClick={() => setIsCreateModalOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="btn-primary flex-1"
                      >
                        {createMutation.isPending ? 'Creating...' : 'Create Template'}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Edit Modal */}
      <Transition appear show={isEditModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsEditModalOpen(false)}
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
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium text-gray-900"
                  >
                    Edit Template
                  </Dialog.Title>

                  <form onSubmit={handleEditSubmit(onEditSubmit)} className="mt-4 space-y-4">
                    <div>
                      <label htmlFor="edit-name" className="label">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="edit-name"
                        type="text"
                        className="input"
                        placeholder="e.g., Document Approval"
                        {...registerEdit('name', { required: 'Name is required' })}
                      />
                      {editErrors.name && (
                        <p className="mt-1 text-sm text-red-600">
                          {editErrors.name.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="edit-description" className="label">
                        Description
                      </label>
                      <textarea
                        id="edit-description"
                        rows={3}
                        className="input"
                        placeholder="Describe the workflow purpose..."
                        {...registerEdit('description')}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="edit-slaDays" className="label">
                          SLA (days)
                        </label>
                        <input
                          id="edit-slaDays"
                          type="number"
                          min="1"
                          className="input"
                          {...registerEdit('slaDays', {
                            required: true,
                            valueAsNumber: true,
                            min: 1,
                          })}
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-escalationDays" className="label">
                          Escalation (days)
                        </label>
                        <input
                          id="edit-escalationDays"
                          type="number"
                          min="1"
                          className="input"
                          {...registerEdit('escalationDays', {
                            required: true,
                            valueAsNumber: true,
                            min: 1,
                          })}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        className="btn-secondary flex-1"
                        onClick={() => setIsEditModalOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="btn-primary flex-1"
                      >
                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
