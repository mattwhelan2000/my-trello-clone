import { getWorkflows } from "@/actions/workflow-management/get-workflows";
import { WorkflowClient } from "./Client";

export default async function WorkflowsPage() {
  const workflows = await getWorkflows();

  return (
    <div className="w-full">
      <WorkflowClient initialWorkflows={workflows} />
    </div>
  );
}
