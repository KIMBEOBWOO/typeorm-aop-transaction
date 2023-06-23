import { DiscoveryService } from '@nestjs/core';

export const getMockDiscoveryService = (
  mockData?: Partial<DiscoveryService>,
): DiscoveryService =>
  ({
    getProviders: jest.fn(),
    ...mockData,
  } as any);
