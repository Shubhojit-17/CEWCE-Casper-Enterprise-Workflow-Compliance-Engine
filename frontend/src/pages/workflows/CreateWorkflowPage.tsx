// =============================================================================
// Create Workflow Page
// =============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { WorkflowTemplate, CreateWorkflowForm } from '../../types';

export function CreateWorkflowPage() {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateWorkflowForm>();

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
        navigate(`/workflows/${workflowId}`);
      } else {
        // Fallback to workflows list if ID not returned
        navigate('/workflows');
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
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/workflows')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Workflow</h1>
          <p className="mt-1 text-sm text-gray-500">
            Start a new workflow instance from a template
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Template Selection */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-medium text-gray-900">Select Template</h2>
          </div>
          <div className="card-body">
            {templatesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-32 bg-gray-200 rounded-lg" />
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
                        ? 'border-enterprise-primary bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <h3 className="font-medium text-gray-900">{template.name}</h3>
                    {template.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        Version {template.version}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-400">
                        {template.states?.length || 0} states
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No published templates available.</p>
                <p className="text-sm mt-1">
                  Go to <a href="/templates" className="text-enterprise-primary hover:underline">Templates</a> to create and publish a template first.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Details */}
        {selectedTemplate && (
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Workflow Details</h2>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label htmlFor="title" className="label">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  className="input"
                  placeholder="Enter workflow title"
                  {...register('title', { required: 'Title is required' })}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
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
                  placeholder="Enter workflow description (optional)"
                  {...register('description')}
                />
              </div>

              {/* Template Preview */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-4">
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
                            ? 'bg-blue-100 text-blue-800'
                            : state.isTerminal
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {state.name}
                      </span>
                      {idx < selectedTemplate.states.length - 1 && (
                        <span className="text-gray-400">→</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-sm text-gray-500">
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
            onClick={() => navigate('/workflows')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedTemplate || createMutation.isPending}
            className="btn-primary"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
          </button>
        </div>
      </form>
    </div>
  );
}
