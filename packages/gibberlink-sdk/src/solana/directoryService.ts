import { AgentIdentity, DirectoryServiceRequest, DirectoryServiceResponse } from './types';

export interface DirectoryServiceConfig {
  serviceUrl: string;
  apiKey?: string;
  cacheLifetimeMs?: number;
}

/**
 * DirectoryService provides a registry of AI agents with their identities
 * and Solana public keys, functioning like a DNS for agents.
 */
export default class DirectoryService {
  private config: DirectoryServiceConfig;
  private cache: Map<string, { data: AgentIdentity; timestamp: number }> = new Map();

  constructor(config: DirectoryServiceConfig) {
    this.config = {
      cacheLifetimeMs: 5 * 60 * 1000, // 5 minutes default cache lifetime
      ...config
    };
  }

  /**
   * Look up an agent by ID, phone number, or public key
   */
  public async lookupAgent(
    params: DirectoryServiceRequest
  ): Promise<DirectoryServiceResponse> {
    try {
      // Check if we need to look up by ID
      if (params.agentId) {
        // Check cache first
        const cachedAgent = this.getFromCache(params.agentId);
        if (cachedAgent) {
          return {
            success: true,
            agent: cachedAgent,
          };
        }
      }

      // Prepare query parameters
      const queryParams = new URLSearchParams();
      if (params.agentId) queryParams.append('agentId', params.agentId);
      if (params.phoneNumber) queryParams.append('phoneNumber', params.phoneNumber);
      if (params.publicKey) queryParams.append('publicKey', params.publicKey);

      // Make API request
      const url = `${this.config.serviceUrl}/lookup?${queryParams.toString()}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['X-API-Key'] = this.config.apiKey;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Directory service error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the result if it's a single agent
      if (data.agent) {
        this.addToCache(data.agent);
      }

      return data;
    } catch (error) {
      console.error('Directory service lookup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Register a new agent with the directory service
   */
  public async registerAgent(agent: AgentIdentity): Promise<DirectoryServiceResponse> {
    try {
      const url = `${this.config.serviceUrl}/register`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['X-API-Key'] = this.config.apiKey;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(agent),
      });

      if (!response.ok) {
        throw new Error(`Directory service error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the registered agent
      if (data.success && data.agent) {
        this.addToCache(data.agent);
      }

      return data;
    } catch (error) {
      console.error('Directory service registration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Add an agent to the cache
   */
  private addToCache(agent: AgentIdentity): void {
    this.cache.set(agent.id, {
      data: agent,
      timestamp: Date.now(),
    });
  }

  /**
   * Get an agent from the cache if it exists and hasn't expired
   */
  private getFromCache(agentId: string): AgentIdentity | null {
    const cached = this.cache.get(agentId);
    if (cached && Date.now() - cached.timestamp < this.config.cacheLifetimeMs!) {
      return cached.data;
    }
    // Remove expired entry
    if (cached) {
      this.cache.delete(agentId);
    }
    return null;
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
} 