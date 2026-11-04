import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decideLeave } from '../api/client';
import axios from 'axios';

vi.mock('axios', () => {
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return {
    default: {
      create: vi.fn(() => instance),
      isAxiosError: vi.fn(),
    },
  };
});

describe('Web Admin: Leaves View & Two-Stage Decision API', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = (axios.create as any)();
  });

  it('sends Stage 2 HR final approval with optional comments', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'Approved' } });

    await decideLeave('leave-123', 'APPROVED', 'HR Final Authorization');

    expect(mockClient.patch).toHaveBeenCalledWith('/leaves/leave-123/decision', {
      decision: 'APPROVED',
      comments: 'HR Final Authorization',
      isHrOverride: undefined,
    });
  });

  it('sends HR Override for Stage 1 manager review', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'Overridden' } });

    await decideLeave('leave-456', 'APPROVED', undefined, true);

    expect(mockClient.patch).toHaveBeenCalledWith('/leaves/leave-456/decision', {
      decision: 'APPROVED',
      comments: undefined,
      isHrOverride: true,
    });
  });

  it('sends Rejection decision with reason comments', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { message: 'Rejected' } });

    await decideLeave('leave-789', 'REJECTED', 'Sprint blackout window');

    expect(mockClient.patch).toHaveBeenCalledWith('/leaves/leave-789/decision', {
      decision: 'REJECTED',
      comments: 'Sprint blackout window',
      isHrOverride: undefined,
    });
  });
});
