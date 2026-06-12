import { ProviderAdapter, ChannelProvider } from "./types";

const registry = new Map<ChannelProvider, ProviderAdapter>();

export function registerAdapter(adapter: ProviderAdapter) {
  registry.set(adapter.provider, adapter);
}

export function getAdapter(provider: ChannelProvider | string): ProviderAdapter {
  const adapter = registry.get(provider as ChannelProvider);
  if (!adapter) {
    throw new Error(`Provider adapter not found for: ${provider}`);
  }
  return adapter;
}

export function getAllAdapters(): ProviderAdapter[] {
  return Array.from(registry.values());
}
