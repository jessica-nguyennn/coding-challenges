export type WorkflowLogLevel = "info" | "error";
export type WorkflowLogContext = Record<string, unknown>;

export interface WorkflowLogger {
    log(
        level: WorkflowLogLevel,
        event: string,
        context: WorkflowLogContext
    ): void;
}

export class ConsoleWorkflowLogger implements WorkflowLogger {
    log(
        level: WorkflowLogLevel,
        event: string,
        context: WorkflowLogContext
    ): void {
        const record = JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            event,
            ...context
        });

        if (level === "error") {
            console.error(record);
        } else {
            console.info(record);
        }
    }
}

export const workflowLogger: WorkflowLogger = new ConsoleWorkflowLogger();
