const { 
  getTodaysDate, 
  isValidDateFormat, 
  getFeatureFlag, 
  setCustomProperty, 
  run,
  calculateExpiryFromCreation,
  formatDateToString,
  filterFlagsNeedingExpiry,
  fetchWithRetry
} = require('../index.js');
const core = require('@actions/core');

// Mock fetch globally
global.fetch = jest.fn();

// Mock @actions/core
jest.mock('@actions/core');

describe('getTodaysDate', () => {
  test('should return date in MM/DD/YYYY format by default', () => {
    const result = getTodaysDate('MM/DD/YYYY');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    
    // Validate it's actually today's date
    const today = new Date();
    const expectedMonth = String(today.getMonth() + 1).padStart(2, '0');
    const expectedDay = String(today.getDate()).padStart(2, '0');
    const expectedYear = today.getFullYear();
    const expectedDate = `${expectedMonth}/${expectedDay}/${expectedYear}`;
    
    expect(result).toBe(expectedDate);
  });

  test('should return date in YYYY-MM-DD format', () => {
    const result = getTodaysDate('YYYY-MM-DD');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    
    // Validate it's actually today's date
    const today = new Date();
    const expectedMonth = String(today.getMonth() + 1).padStart(2, '0');
    const expectedDay = String(today.getDate()).padStart(2, '0');
    const expectedYear = today.getFullYear();
    const expectedDate = `${expectedYear}-${expectedMonth}-${expectedDay}`;
    
    expect(result).toBe(expectedDate);
  });

  test('should return date in MM-DD-YYYY format', () => {
    const result = getTodaysDate('MM-DD-YYYY');
    expect(result).toMatch(/^\d{2}-\d{2}-\d{4}$/);
  });

  test('should return date in YYYY/MM/DD format', () => {
    const result = getTodaysDate('YYYY/MM/DD');
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  test('should default to MM/DD/YYYY for unknown format', () => {
    const result = getTodaysDate('UNKNOWN');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  test('should handle case insensitive format', () => {
    const result1 = getTodaysDate('mm/dd/yyyy');
    const result2 = getTodaysDate('MM/DD/YYYY');
    expect(result1).toBe(result2);
  });
});

describe('isValidDateFormat', () => {
  test('should validate MM/DD/YYYY format correctly', () => {
    expect(isValidDateFormat('03/15/2024', 'MM/DD/YYYY')).toBe(true);
    expect(isValidDateFormat('12/31/2024', 'MM/DD/YYYY')).toBe(true);
    expect(isValidDateFormat('01/01/2025', 'MM/DD/YYYY')).toBe(true);
    expect(isValidDateFormat('1/1/2025', 'MM/DD/YYYY')).toBe(true); // Single digits
    
    // Invalid cases
    expect(isValidDateFormat('13/15/2024', 'MM/DD/YYYY')).toBe(false);
    expect(isValidDateFormat('03/32/2024', 'MM/DD/YYYY')).toBe(false);
    expect(isValidDateFormat('2024/03/15', 'MM/DD/YYYY')).toBe(false);
    expect(isValidDateFormat('03-15-2024', 'MM/DD/YYYY')).toBe(false);
  });

  test('should validate YYYY-MM-DD format correctly', () => {
    expect(isValidDateFormat('2024-03-15', 'YYYY-MM-DD')).toBe(true);
    expect(isValidDateFormat('2024-12-31', 'YYYY-MM-DD')).toBe(true);
    expect(isValidDateFormat('2025-01-01', 'YYYY-MM-DD')).toBe(true);
    expect(isValidDateFormat('2025-1-1', 'YYYY-MM-DD')).toBe(true); // Single digits
    
    // Invalid cases
    expect(isValidDateFormat('2024-13-15', 'YYYY-MM-DD')).toBe(false);
    expect(isValidDateFormat('2024-03-32', 'YYYY-MM-DD')).toBe(false);
    expect(isValidDateFormat('03-15-2024', 'YYYY-MM-DD')).toBe(false);
    expect(isValidDateFormat('2024/03/15', 'YYYY-MM-DD')).toBe(false);
  });

  test('should validate MM-DD-YYYY format correctly', () => {
    expect(isValidDateFormat('03-15-2024', 'MM-DD-YYYY')).toBe(true);
    expect(isValidDateFormat('12-31-2024', 'MM-DD-YYYY')).toBe(true);
    expect(isValidDateFormat('1-1-2025', 'MM-DD-YYYY')).toBe(true);
    
    // Invalid cases
    expect(isValidDateFormat('13-15-2024', 'MM-DD-YYYY')).toBe(false);
    expect(isValidDateFormat('03-32-2024', 'MM-DD-YYYY')).toBe(false);
    expect(isValidDateFormat('03/15/2024', 'MM-DD-YYYY')).toBe(false);
  });

  test('should validate YYYY/MM/DD format correctly', () => {
    expect(isValidDateFormat('2024/03/15', 'YYYY/MM/DD')).toBe(true);
    expect(isValidDateFormat('2024/12/31', 'YYYY/MM/DD')).toBe(true);
    expect(isValidDateFormat('2025/1/1', 'YYYY/MM/DD')).toBe(true);
    
    // Invalid cases
    expect(isValidDateFormat('2024/13/15', 'YYYY/MM/DD')).toBe(false);
    expect(isValidDateFormat('2024/03/32', 'YYYY/MM/DD')).toBe(false);
    expect(isValidDateFormat('03/15/2024', 'YYYY/MM/DD')).toBe(false);
  });

  test('should handle edge cases', () => {
    expect(isValidDateFormat('', 'MM/DD/YYYY')).toBe(false);
    expect(isValidDateFormat(null, 'MM/DD/YYYY')).toBe(false);
    expect(isValidDateFormat(undefined, 'MM/DD/YYYY')).toBe(false);
    expect(isValidDateFormat('03/15/2024', 'INVALID_FORMAT')).toBe(false);
  });

  test('should validate leap years correctly', () => {
    expect(isValidDateFormat('02/29/2024', 'MM/DD/YYYY')).toBe(true); // 2024 is leap year
    expect(isValidDateFormat('02/29/2023', 'MM/DD/YYYY')).toBe(false); // 2023 is not leap year
    expect(isValidDateFormat('2024-02-29', 'YYYY-MM-DD')).toBe(true);
    expect(isValidDateFormat('2023-02-29', 'YYYY-MM-DD')).toBe(false);
  });

  test('should handle case insensitive format matching', () => {
    expect(isValidDateFormat('03/15/2024', 'mm/dd/yyyy')).toBe(true);
    expect(isValidDateFormat('2024-03-15', 'yyyy-mm-dd')).toBe(true);
  });
});

describe('calculateExpiryFromCreation', () => {
  test('should calculate expiry date correctly', () => {
    const flag = {
      key: 'test-flag',
      creationDate: 1752875955933 // July 18, 2025
    };
    
    const result = calculateExpiryFromCreation(flag, 30, 'MM/DD/YYYY');
    expect(result).toBe('08/17/2025'); // 30 days later
  });

  test('should handle different date formats', () => {
    const flag = {
      key: 'test-flag',
      creationDate: 1752875955933 // July 18, 2025
    };
    
    expect(calculateExpiryFromCreation(flag, 30, 'YYYY-MM-DD')).toBe('2025-08-17');
    expect(calculateExpiryFromCreation(flag, 30, 'MM-DD-YYYY')).toBe('08-17-2025');
    expect(calculateExpiryFromCreation(flag, 30, 'YYYY/MM/DD')).toBe('2025/08/17');
  });

  test('should throw error for invalid creation date', () => {
    const flag = {
      key: 'test-flag',
      creationDate: 'invalid-date'
    };
    
    expect(() => calculateExpiryFromCreation(flag, 30, 'MM/DD/YYYY'))
      .toThrow('Invalid creation date for flag test-flag: invalid-date');
  });
});

describe('formatDateToString', () => {
  test('should format dates correctly', () => {
    const date = new Date(2025, 7, 17); // August 17, 2025 (month is 0-indexed)
    
    expect(formatDateToString(date, 'MM/DD/YYYY')).toBe('08/17/2025');
    expect(formatDateToString(date, 'YYYY-MM-DD')).toBe('2025-08-17');
    expect(formatDateToString(date, 'MM-DD-YYYY')).toBe('08-17-2025');
    expect(formatDateToString(date, 'YYYY/MM/DD')).toBe('2025/08/17');
  });

  test('should default to MM/DD/YYYY for unknown format', () => {
    const date = new Date(2025, 7, 17);
    expect(formatDateToString(date, 'UNKNOWN')).toBe('08/17/2025');
  });
});

describe('filterFlagsNeedingExpiry', () => {
  const mockFlags = [
    {
      key: 'flag-with-expiry',
      name: 'Flag With Expiry',
      creationDate: 1752875955933,
      customProperties: {
        'flag.expiry.date': {
          name: 'flag.expiry.date',
          value: ['08/17/2025']
        }
      }
    },
    {
      key: 'flag-without-expiry',
      name: 'Flag Without Expiry',
      creationDate: 1752875955933,
      customProperties: {}
    },
    {
      key: 'flag-invalid-date',
      name: 'Flag Invalid Date',
      creationDate: null,
      customProperties: {}
    }
  ];

  beforeEach(() => {
    core.info = jest.fn();
  });

  test('should filter flags correctly with skip existing', () => {
    const result = filterFlagsNeedingExpiry(mockFlags, 'flag.expiry.date', true);
    
    expect(result.flagsToProcess).toHaveLength(1);
    expect(result.flagsToProcess[0].key).toBe('flag-without-expiry');
    
    expect(result.flagsSkipped).toHaveLength(2);
    expect(result.flagsSkipped.find(f => f.key === 'flag-with-expiry').reason).toContain('Already has');
    expect(result.flagsSkipped.find(f => f.key === 'flag-invalid-date').reason).toBe('Invalid or missing creation date');
  });

  test('should include flags with existing expiry when skip existing is false', () => {
    const result = filterFlagsNeedingExpiry(mockFlags, 'flag.expiry.date', false);
    
    expect(result.flagsToProcess).toHaveLength(2);
    expect(result.flagsSkipped).toHaveLength(1);
    expect(result.flagsSkipped[0].key).toBe('flag-invalid-date');
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    fetch.mockClear();
    core.warning = jest.fn();
  });

  test('should succeed on first try', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true })
    };
    
    fetch.mockResolvedValueOnce(mockResponse);
    
    const result = await fetchWithRetry('http://test.com', {});
    expect(result).toBe(mockResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('should retry on 429 rate limit', async () => {
    fetch
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    
    const result = await fetchWithRetry('http://test.com', {}, 2);
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Rate limited'));
  }, 15000);

  test('should throw error after max retries', async () => {
    const mockErrorResponse = { 
      ok: false, 
      status: 500, 
      statusText: 'Server Error', 
      text: jest.fn().mockResolvedValue('') 
    };
    
    fetch
      .mockResolvedValueOnce(mockErrorResponse)
      .mockResolvedValueOnce(mockErrorResponse);
    
    await expect(fetchWithRetry('http://test.com', {}, 2))
      .rejects.toThrow('HTTP 500: Server Error');
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 15000);
});

describe('getFeatureFlag', () => {
  beforeEach(() => {
    fetch.mockClear();
    core.debug = jest.fn();
  });

  test('should fetch flag successfully', async () => {
    const mockFlag = {
      key: 'test-flag',
      name: 'Test Flag',
      customProperties: {}
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFlag
    });

    const result = await getFeatureFlag('test-api-key', 'test-project', 'test-flag');
    expect(result).toEqual(mockFlag);
  }, 10000);

  test('should return null for 404 (flag not found)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const result = await getFeatureFlag('test-api-key', 'test-project', 'non-existent-flag');
    expect(result).toBeNull();
  });

  test('should throw error for other HTTP errors', async () => {
    // Mock multiple calls since fetchWithRetry will retry
    const mockErrorResponse = { 
      ok: false, 
      status: 401, 
      statusText: 'Unauthorized', 
      text: jest.fn().mockResolvedValue('') 
    };
    
    fetch
      .mockResolvedValueOnce(mockErrorResponse)
      .mockResolvedValueOnce(mockErrorResponse)
      .mockResolvedValueOnce(mockErrorResponse);

    await expect(getFeatureFlag('invalid-api-key', 'test-project', 'test-flag'))
      .rejects.toThrow('HTTP 401: Unauthorized. Please check your API key is valid and has the required permissions.');
  }, 20000);
});

describe('setCustomProperty', () => {
  beforeEach(() => {
    fetch.mockClear();
    core.debug = jest.fn();
  });

  test('should set custom property successfully', async () => {
    const mockResponse = {
      key: 'test-flag',
      customProperties: {
        'flag.expiry.date': {
          name: 'flag.expiry.date',
          value: ['03/15/2024']
        }
      }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await setCustomProperty('test-api-key', 'test-project', 'test-flag', 'flag.expiry.date', '03/15/2024');
    expect(result).toEqual(mockResponse);
  }, 10000);

  test('should use correct JSON patch format with "value" field', async () => {
    const mockResponse = {
      key: 'test-flag',
      customProperties: {
        'flag.expiry.date': {
          name: 'flag.expiry.date',
          value: ['03/15/2024']
        }
      }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    await setCustomProperty('test-api-key', 'test-project', 'test-flag', 'flag.expiry.date', '03/15/2024');
    
    // Verify the request was made with correct format
    expect(fetch).toHaveBeenCalledWith(
      'https://app.launchdarkly.com/api/v2/flags/test-project/test-flag',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'Authorization': 'test-api-key',
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          patch: [
            {
              op: 'add',
              path: '/customProperties/flag.expiry.date',
              value: {
                name: 'flag.expiry.date',
                value: ['03/15/2024']  // Should be "value" not "values"
              }
            }
          ]
        })
      })
    );
  });

  test('should throw error for 401 (unauthorized)', async () => {
    // Mock multiple calls since fetchWithRetry will retry
    const mockErrorResponse = { 
      ok: false, 
      status: 401, 
      statusText: 'Unauthorized', 
      text: jest.fn().mockResolvedValue('') 
    };
    
    fetch
      .mockResolvedValueOnce(mockErrorResponse)
      .mockResolvedValueOnce(mockErrorResponse)
      .mockResolvedValueOnce(mockErrorResponse);

    await expect(setCustomProperty('invalid-api-key', 'test-project', 'test-flag', 'flag.expiry.date', '03/15/2024'))
      .rejects.toThrow('HTTP 401: Unauthorized. Please check your API key is valid and has the required permissions. Please check your API key has WRITE permissions.');
  }, 20000);

  test('should throw error for 404 (flag not found)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    await expect(setCustomProperty('test-api-key', 'test-project', 'non-existent-flag', 'flag.expiry.date', '03/15/2024'))
      .rejects.toThrow('HTTP 404: Not Found. Resource may not exist or you don\'t have access to it. Flag \'non-existent-flag\' may not exist in project \'test-project\'.');
  });
});

describe('run function integration', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock core functions
    core.getInput = jest.fn();
    core.info = jest.fn();
    core.error = jest.fn();
    core.debug = jest.fn();
    core.warning = jest.fn();
    core.setOutput = jest.fn();
    core.setFailed = jest.fn();
    core.summary = {
      addHeading: jest.fn().mockReturnThis(),
      addRaw: jest.fn().mockReturnThis(),
      addTable: jest.fn().mockReturnThis(),
      write: jest.fn().mockResolvedValue()
    };
    
    fetch.mockClear();
  });

  test('should validate required inputs', async () => {
    core.getInput.mockImplementation((name) => {
      switch (name) {
        case 'launchdarkly_api_key': return '';
        case 'project_key': return 'test-project';
        case 'days_from_creation': return '30';
        default: return '';
      }
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('Action failed with error: LaunchDarkly API key cannot be empty');
  });

  test('should validate days_from_creation input', async () => {
    core.getInput.mockImplementation((name) => {
      switch (name) {
        case 'launchdarkly_api_key': return 'test-api-key';
        case 'project_key': return 'test-project';
        case 'days_from_creation': return 'invalid';
        default: return '';
      }
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('Action failed with error: Invalid days_from_creation value: invalid. Must be a number between 1 and 365');
  });

  test('should process flags successfully', async () => {
    core.getInput.mockImplementation((name) => {
      switch (name) {
        case 'launchdarkly_api_key': return 'test-api-key';
        case 'project_key': return 'test-project';
        case 'days_from_creation': return '30';
        case 'custom_property_name': return 'flag.expiry.date';
        case 'date_format': return 'MM/DD/YYYY';
        case 'skip_existing': return 'true';
        default: return '';
      }
    });

    // Mock getAllFeatureFlags response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            key: 'test-flag',
            name: 'Test Flag',
            creationDate: 1752875955933, // July 18, 2025
            customProperties: {}
          }
        ],
        totalCount: 1
      })
    });

    // Mock setCustomProperty response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        key: 'test-flag',
        customProperties: {
          'flag.expiry.date': {
            name: 'flag.expiry.date',
            value: ['08/17/2025']
          }
        }
      })
    });

    await run();

    expect(core.setOutput).toHaveBeenCalledWith('total_processed', '1');
    expect(core.setOutput).toHaveBeenCalledWith('total_found', '1');
    expect(core.setOutput).toHaveBeenCalledWith('total_skipped', '0');
  });

  test('should skip flags with existing expiry dates', async () => {
    core.getInput.mockImplementation((name) => {
      switch (name) {
        case 'launchdarkly_api_key': return 'test-api-key';
        case 'project_key': return 'test-project';
        case 'days_from_creation': return '30';
        case 'skip_existing': return 'true';
        default: return '';
      }
    });

    // Mock getAllFeatureFlags response with flag that already has expiry
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            key: 'test-flag',
            name: 'Test Flag',
            creationDate: 1752875955933,
            customProperties: {
              'flag.expiry.date': {
                name: 'flag.expiry.date',
                value: ['08/17/2025']
              }
            }
          }
        ],
        totalCount: 1
      })
    });

    await run();

    expect(core.setOutput).toHaveBeenCalledWith('total_processed', '0');
    expect(core.setOutput).toHaveBeenCalledWith('total_found', '1');
    expect(core.setOutput).toHaveBeenCalledWith('total_skipped', '1');
  });
});
