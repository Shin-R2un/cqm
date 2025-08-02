/**
 * プラグインシステム
 */
import { Plugin } from '@cqm/shared';

export interface PluginManager {
  loadPlugin(name: string): Promise<void>;
  unloadPlugin(name: string): Promise<void>;
  getPlugin(name: string): Plugin | undefined;
  listPlugins(): Plugin[];
}

export class DefaultPluginManager implements PluginManager {
  private plugins = new Map<string, Plugin>();

  async loadPlugin(name: string): Promise<void> {
    // プラグインロード処理（実装予定）
    const plugin: Plugin = {
      name,
      version: '0.1.0',
      enabled: true,
      config: {},
    };
    
    this.plugins.set(name, plugin);
  }

  async unloadPlugin(name: string): Promise<void> {
    this.plugins.delete(name);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}