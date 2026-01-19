// =============================================================================
// Create Workflow Page - Luminous Dark Cyberpunk Enterprise Theme
// =============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeftIcon, UserIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { WorkflowTemplate, CreateWorkflowForm, User } from '../../types';

export function CreateWorkflowPage() {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateWorkflowForm>();

  // Fetch users who can be assigned as customers (USER or CUSTOMER role)
  const { data: customersData } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const response = await api.get<{ data: { users: User[] } }>('/users/assignable-customers');
      return response.data.data.users || [];
    },
  });

  const customers = customersData || [];

  // Fetch templates - filter for PUBLISHED status
  const { data: allTemplates, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates-for-workflow'],
    queryFn: async () => {
      const response = await api.get<{ data: { workflows: WorkflowTemplate[] } }>('/workflows');
      return response.data.data.workflows || [];
    },
  });
  
  // Filter to only show PUBLISHED templates
  const templates = allTemplates?.filter(t => t.status === 'PUBLISHED') || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateWorkflowForm) => {
      const response = await api.post('/workflow-instances', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Workflow created successfully');
      // Response structure: { success, data: { instance, deploy, message } }
      const workflowId = data.data?.instance?.id;
      if (workflowId) {
        navigate(`/app/workflows/${workflowId}`);
      } else {
        // Fallback to workflows list if ID not returned
        navigate('/app/workflows');
      }
    },
    onError: () => {
      toast.error('Failed to create workflow');
    },
  });

  const onSubmit = (data: CreateWorkflowForm) => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }
    createMutation.mutate({
      ...data,
      templateId: selectedTemplate.id,
      assignedCustomerId: selectedCustomerId || null,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/workflows')}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Create New Workflow</h1>
          <p className="mt-1 text-sm text-slate-400">
            Start a new workflow instance from a template
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Template Selection */}
        <div className="glass-card">
          <div className="glass-card-header">
            <h2 className="text-lg font-medium text-white">Select Template</h2>
          </div>
          <div className="glass-card-body">
            {templatesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-32 bg-white/10 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : templates && templates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplate(template)}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      selectedTemplate?.id === template.id
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-white/10 hover:border-white/20 bg-white/5'
                    }`}
                  >
                    <h3 className="font-medium text-white">{template.name}</h3>
                    {template.description && (
                      <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        Version {template.version}
                      </span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-500">
                        {template.states?.length || 0} states
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p>No published templates available.</p>
                <p className="text-sm mt-1">
                  Go to <a href="/templates" className="text-red-400 hover:text-red-300 hover:underline">Templates</a> to create and publish a template first.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Details */}
        {selectedTemplate && (
          <div className="glass-card">
            <div className="glass-card-header">
              <h2 className="text-lg font-medium text-white">Workflow Details</h2>
            </div>
            <div className="glass-card-body space-y-4">
              <div>
                <label htmlFor="title" className="label-dark">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  className="input-dark"
                  placeholder="Enter workflow title"
                  {...register('title', { required: 'Title is required' })}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-400">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="description" className="label-dark">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  className="input-dark"
                  placeholder="Enter workflow description (optional)"
                  {...register('description')}
                />
              </div>

              {/* Customer Assignment */}
              <div>
                <label htmlFor="assignedCustomerId" className="label-dark">
                  <span className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    Assign to Customer
                  </span>
                </label>
                <select
                  id="assignedCustomerId"
                  className="input-dark"
                  value={selectedCustomerId || ''}
                  onChange={(e) => setSelectedCustomerId(e.target.value || null)}
                >
                  <option value="">No customer assignment (proceed directly)</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.email} {customer.firstName || customer.lastName ? `(${[customer.firstName, customer.lastName].filter(Boolean).join(' ')})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  If assigned, the customer must confirm before the workflow proceeds to blockchain.
                </p>
              </div>

              {/* Template Preview */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-sm font-medium text-white mb-4">
                  Template: {selectedTemplate.name}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.states.map((state, idx) => (
                    <div
                      key={state.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className={`px-2 py-1 rounded ${
                          state.isInitial
                            ? 'bg-blue-500/20 text-blue-400'
                            : state.isTerminal
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {state.name}
                      </span>
                      {idx < selectedTemplate.states.length - 1 && (
                        <span className="text-slate-600">→</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-sm text-slate-400">
                  <p>SLA: {selectedTemplate.slaDays} days</p>
                  <p>Escalation: {selectedTemplate.escalationDays} days</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/workflows')}
            className="btn-dark-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedTemplate || createMutation.isPending}
            className="btn-dark-primary"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
          </button>
        </div>
      </form>
    </div>
  );
}
