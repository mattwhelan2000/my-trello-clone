"use client";

import { useState } from "react";
import { ComfyUIWorkflow } from "@prisma/client";
import { useAction } from "@/hooks/use-action";
import { createWorkflow } from "@/actions/workflow-management/create-workflow";
import { deleteWorkflow } from "@/actions/workflow-management/delete-workflow";
import { useToast } from "@/components/ui/Toast";
import { Loader2, Trash2, Plus, FileJson } from "lucide-react";

interface WorkflowClientProps {
  initialWorkflows: ComfyUIWorkflow[];
}

export const WorkflowClient = ({ initialWorkflows }: WorkflowClientProps) => {
  const [workflows, setWorkflows] = useState<ComfyUIWorkflow[]>(initialWorkflows);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [json, setJson] = useState("");
  const { addToast } = useToast();

  // @ts-ignore
  const { execute: executeCreate, isLoading: isCreating } = useAction(createWorkflow, {
    onSuccess: (data: ComfyUIWorkflow) => {
      addToast(`Workflow "${data.name}" created!`, "success");
      setWorkflows([data, ...workflows]);
      setIsModalOpen(false);
      setName("");
      setJson("");
    },
    onError: (error: string) => {
      addToast(error, "error");
    }
  });

  // @ts-ignore
  const { execute: executeDelete, isLoading: isDeleting } = useAction(deleteWorkflow, {
    onSuccess: (data: ComfyUIWorkflow) => {
      addToast(`Workflow deleted!`, "success");
      setWorkflows(workflows.filter(w => w.id !== data.id));
    },
    onError: (error: string) => {
      addToast(error, "error");
    }
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !json.trim()) return;
    executeCreate({ name, json });
  };

  const onDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this workflow?")) {
      executeDelete({ id });
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-700">ComfyUI Workflows</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage your custom JSON workflows for AI Image Generation.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-x-2 transition"
        >
          <Plus className="h-4 w-4" />
          Add Workflow
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-md text-neutral-500 flex flex-col items-center">
            <FileJson className="h-12 w-12 text-neutral-300 mb-4" />
            <p>No workflows found.</p>
            <p className="text-sm mt-1">Export your workflow as API Format in ComfyUI and paste it here.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-md shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 border-b text-neutral-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Created Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="hover:bg-neutral-50/50">
                  <td className="px-6 py-4 font-medium text-neutral-800">{workflow.name}</td>
                  <td className="px-6 py-4">{new Date(workflow.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onDelete(workflow.id)}
                      disabled={isDeleting}
                      className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-md transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Add New Workflow</h2>
              <p className="text-sm text-neutral-500 mt-1">Paste your exported 'workflow_api.json' code below.</p>
            </div>
            
            <form onSubmit={onSubmit} className="p-6 flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-1">
                <label className="text-sm font-semibold">Workflow Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Flux 2 Turbo Dev"
                  className="border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex flex-col gap-y-1">
                <label className="text-sm font-semibold">JSON Code</label>
                <textarea
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  placeholder="{\n  '3': {\n    'inputs': ...\n  }\n}"
                  className="border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono h-64 resize-y"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-x-3 mt-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !name.trim() || !json.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-x-2 transition disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Save Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
