const { getTodaysDate, isValidDateFormat, getFeatureFlag, setCustomProperty, run } = require('./index.js');
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
    
    expect(fetch).toHaveBeenCalledWith(
      'https://app.launchdarkly.com/api/v2/flags/test-project/test-flag',
      {
        headers: {
          'Authorization': 'test-api-key',
          'Content-Type': 'application/json'
        }
      }
    );
    
    expect(result).toEqual(mockFlag);
  });

  test('should return null for 404 (flag not found)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    const result = await getFeatureFlag('test-api-key', 'test-project', 'non-existent-flag');
    expect(result).toBeNull();
  });

  test('should throw error for 401 (unauthorized)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    });

    await expect(getFeatureFlag('invalid-api-key', 'test-project', 'test-flag'))
      .rejects.toThrow('LaunchDarkly API request failed: 401 Unauthorized. Please check your API key is valid and has the required permissions.');
  });

  test('should throw error for 429 (rate limit)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests'
    });

    await expect(getFeatureFlag('test-api-key', 'test-project', 'test-flag'))
      .rejects.toThrow('LaunchDarkly API request failed: 429 Too Many Requests. Rate limit exceeded. Please wait and try again.');
  });
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
    
    expect(fetch).toHaveBeenCalledWith(
      'https://app.launchdarkly.com/api/v2/flags/test-project/test-flag',
      {
        method: 'PATCH',
        headers: {
          'Authorization': 'test-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patch: [
            {
              op: 'replace',
              path: '/customProperties/flag.expiry.date',
              value: {
                name: 'flag.expiry.date',
                value: ['03/15/2024']
              }
            }
          ]
        })
      }
    );
    
    expect(result).toEqual(mockResponse);
  });

  test('should throw error for 401 (unauthorized)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    });

    await expect(setCustomProperty('invalid-api-key', 'test-project', 'test-flag', 'flag.expiry.date', '03/15/2024'))
      .rejects.toThrow('LaunchDarkly API request failed: 401 Unauthorized. Please check your API key has WRITE permissions.');
  });

  test('should throw error for 404 (flag not found)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    await expect(setCustomProperty('test-api-key', 'test-project', 'non-existent-flag', 'flag.expiry.date', '03/15/2024'))
      .rejects.toThrow('LaunchDarkly API request failed: 404 Not Found. Flag \'non-existent-flag\' may not exist in project \'test-project\'.');
  });

  test('should include error details from response body', async () => {
    const errorResponse = {
      message: 'Custom property validation failed'
    };

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => errorResponse
    });

    await expect(setCustomProperty('test-api-key', 'test-project', 'test-flag', 'invalid.property', 'value'))
      .rejects.toThrow('LaunchDarkly API request failed: 400 Bad Request. Details: Custom property validation failed');
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
        case 'flag_keys': return 'test-flag';
        default: return '';
      }
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('Action failed with error: LaunchDarkly API key cannot be empty');
  });

  test('should validate flag keys input', async () => {
    core.getInput.mockImplementation((name) => {
      switch (name) {
        case 'launchdarkly_api_key': return 'test-api-key';
        case 'project_key': return 'test-project';
        case 'flag_keys': return '';
        default: return '';
      }
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('Action failed with error: Flag keys cannot be empty');
  });

  test('should process successful flag update', async () => {
    core.getInput.mockImplementation((name) => {
      switch (name) {
        case 'launchdarkly_api_key': return 'test-api-key';
        case 'project_key': return 'test-project';
        case 'flag_keys': return 'test-flag';
        case 'custom_property_name': return 'flag.expiry.date';
        case 'expiry_date': return '03/15/2024';
        case 'date_format': return 'MM/DD/YYYY';
        default: return '';
      }
    });

    // Mock successful flag fetch
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        key: 'test-flag',
        name: 'Test Flag'
      })
    });

    // Mock successful property set
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        key: 'test-flag',
        customProperties: {
          'flag.expiry.date': {
            name: 'flag.expiry.date',
            value: ['03/15/2024']
          }
        }
      })
    });

    await run();

    expect(core.setOutput).toHaveBeenCalledWith('total_processed', '1');
    expect(core.info).toHaveBeenCalledWith('✅ Successfully set expiry date for flag: test-flag');
  });
});
