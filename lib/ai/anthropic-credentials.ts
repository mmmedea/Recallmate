export type AnthropicCredentialGroup = "primary" | "secondary";

export type AnthropicCredential = {
  slot: number;
  envName: string;
  group: AnthropicCredentialGroup;
  priority: number;
  apiKey: string;
};

const NUMBERED_KEY_SLOTS: Array<Omit<AnthropicCredential, "apiKey">> = [
  { slot: 1, envName: "ANTHROPIC_API_KEY_1", group: "primary", priority: 1 },
  { slot: 2, envName: "ANTHROPIC_API_KEY_2", group: "primary", priority: 2 },
  { slot: 3, envName: "ANTHROPIC_API_KEY_3", group: "primary", priority: 3 },
  { slot: 4, envName: "ANTHROPIC_API_KEY_4", group: "secondary", priority: 4 },
  { slot: 5, envName: "ANTHROPIC_API_KEY_5", group: "secondary", priority: 5 },
];

export function getAnthropicCredentials(): AnthropicCredential[] {
  const numbered = NUMBERED_KEY_SLOTS.flatMap((slot) => {
    const apiKey = process.env[slot.envName]?.trim();
    return apiKey ? [{ ...slot, apiKey }] : [];
  });

  if (numbered.length > 0) {
    return numbered.sort((a, b) => a.priority - b.priority);
  }

  const legacyKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!legacyKey) return [];

  return [
    {
      slot: 0,
      envName: "ANTHROPIC_API_KEY",
      group: "primary",
      priority: 0,
      apiKey: legacyKey,
    },
  ];
}

export function hasAnthropicCredentials() {
  return getAnthropicCredentials().length > 0;
}

export function getAnthropicCredentialSummary() {
  return getAnthropicCredentials().map(({ slot, envName, group, priority }) => ({
    slot,
    envName,
    group,
    priority,
  }));
}
