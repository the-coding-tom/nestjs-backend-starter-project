export class CreateWebhookEventLogData {
    source: string;
    event: string;
    externalEventId?: string;
    referenceId?: string;
    payload: Record<string, any>;
}

export class WebhookEventLogEntity {
    id: number;
    source: string;
    event: string;
    externalEventId: string | null;
    referenceId: string | null;
    payload: any;
    createdAt: Date;
}
