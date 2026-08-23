export type CompletedLifecycleRecord = {
  operation: "notebook" | "analysis-entry" | "analysis-update";
  state: "completed";
  label: string;
};

type LifecycleMessage = {
  id: string;
  lifecycleRecords?: CompletedLifecycleRecord[];
};

export function withCompletedLifecycleRecord<T extends LifecycleMessage>(message: T, record: CompletedLifecycleRecord): T {
  const records = message.lifecycleRecords ?? [];
  if (records.some((current) => current.operation === record.operation)) return message;
  return { ...message, lifecycleRecords: [...records, record] };
}

export function addCompletedLifecycleRecord<T extends LifecycleMessage>(messages: T[], assistantId: string, record: CompletedLifecycleRecord): T[] {
  return messages.map((message) => message.id === assistantId ? withCompletedLifecycleRecord(message, record) : message);
}
