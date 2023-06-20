import { DiscoveryService } from '@nestjs/core';

export const getMockDiscoveryService = (): DiscoveryService =>
  ({
    getProviders: jest.fn(),
  } as any);
