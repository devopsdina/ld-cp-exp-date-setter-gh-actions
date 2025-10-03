const core = require('@actions/core');

// Rate limiting and retry constants
const RATE_LIMIT_DELAY = 500; // milliseconds between requests (increased from 100ms)
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 second base delay for retries (increased from 1s)
const BATCH_SIZE = 5; // Process 5 flags at a time (reduced from 10)
const BATCH_DELAY = 2000; // 2 second delay between batches (increased from 500ms)

/**
 * Sleep utility function
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic and 429 handling
 */
async function fetchWithRetry(url, options, maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limited - exponential backoff as per LaunchDarkly docs
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        core.warning(`Rate limited (attempt ${attempt}/${maxRetries}), waiting ${delay}ms`);
        await sleep(delay);
        continue;
      }
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Add specific guidance for common errors
        if (response.status === 401) {
          errorMessage += '. Please check your API key is valid and has the required permissions.';
        } else if (response.status === 404) {
          errorMessage += '. Resource may not exist or you don\'t have access to it.';
        }
        
        throw new Error(errorMessage);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries && !error.message.includes('HTTP 404')) {
        const delay = RETRY_DELAY * attempt;
        core.warning(`Request failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms`);
        await sleep(delay);
      } else {
        break; // Don't retry 404s or on final attempt
      }
    }
  }
  
  throw lastError;
}

/**
 * Main action entry point
 */
async function run() {
  try {
    // Get input parameters
    const apiKey = core.getInput('launchdarkly_api_key', { required: true });
    const projectKey = core.getInput('project_key', { required: true });
    const customPropertyName = core.getInput('custom_property_name') || 'flag.expiry.date';
    const dateFormat = core.getInput('date_format') || 'MM/DD/YYYY';
    
    // New programmatic inputs
    const daysFromCreationInput = core.getInput('days_from_creation') || '30';
    const daysFromCreation = parseInt(daysFromCreationInput, 10);
    const skipExisting = core.getInput('skip_existing') !== 'false'; // Default to true

    // Validate inputs
    if (!apiKey.trim()) {
      throw new Error('LaunchDarkly API key cannot be empty');
    }
    if (!projectKey.trim()) {
      throw new Error('Project key cannot be empty');
    }
    if (!customPropertyName.trim()) {
      throw new Error('Custom property name cannot be empty');
    }
    if (isNaN(daysFromCreation) || daysFromCreation < 1 || daysFromCreation > 365) {
      throw new Error(`Invalid days_from_creation value: ${daysFromCreationInput}. Must be a number between 1 and 365`);
    }

    core.info(`🚀 Starting LaunchDarkly Flag Expiry Setter`);
    core.info(`📋 Project: ${projectKey}`);
    core.info(`📅 Days from creation: ${daysFromCreation}`);
    core.info(`🏷️  Custom property: ${customPropertyName}`);
    core.info(`📊 Date format: ${dateFormat}`);
    core.info(`⏭️  Skip existing: ${skipExisting}`);

    // 1. Fetch all flags with proper pagination/throttling
    const allFlags = await getAllFeatureFlagsWithThrottling(apiKey, projectKey);

    // 2. Filter flags that need expiry dates
    const { flagsToProcess, flagsSkipped } = filterFlagsNeedingExpiry(allFlags, customPropertyName, skipExisting);

    // 3. Process flags in batches
    let results = {
      updatedFlags: [],
      failedFlags: [],
      totalProcessed: 0
    };

    if (flagsToProcess.length > 0) {
      results = await processFlagsInBatches(
        flagsToProcess, 
        apiKey, 
        projectKey, 
        customPropertyName, 
        daysFromCreation, 
        dateFormat
      );
    }

    // 4. Output comprehensive results
    core.info(`\n📊 Final Summary:`);
    core.info(`🔍 Total flags found: ${allFlags.length}`);
    core.info(`⏭️  Flags skipped: ${flagsSkipped.length}`);
    core.info(`✅ Successfully updated: ${results.updatedFlags.length}`);
    core.info(`❌ Failed to update: ${results.failedFlags.length}`);
    core.info(`📋 Total processed: ${results.totalProcessed}`);

    // Log skipped flags summary
    if (flagsSkipped.length > 0) {
      core.info(`\n⏭️  Skipped flags breakdown:`);
      const skipReasons = {};
      flagsSkipped.forEach(flag => {
        const reason = flag.reason.includes('Already has') ? 'Already has expiry' : flag.reason;
        skipReasons[reason] = (skipReasons[reason] || 0) + 1;
      });
      Object.entries(skipReasons).forEach(([reason, count]) => {
        core.info(`  - ${reason}: ${count} flags`);
      });
    }

    // Set outputs (including skipped flags)
    core.setOutput('updated_flags', JSON.stringify(results.updatedFlags));
    core.setOutput('failed_flags', JSON.stringify(results.failedFlags));
    core.setOutput('skipped_flags', JSON.stringify(flagsSkipped));
    core.setOutput('total_processed', results.totalProcessed.toString());
    core.setOutput('total_found', allFlags.length.toString());
    core.setOutput('total_skipped', flagsSkipped.length.toString());

    // Create comprehensive summary
    core.summary.addHeading('LaunchDarkly Flag Expiry Setter Results');
    core.summary.addRaw(`**Project:** ${projectKey}\n`);
    core.summary.addRaw(`**Days from Creation:** ${daysFromCreation}\n`);
    core.summary.addRaw(`**Custom Property:** ${customPropertyName}\n`);
    core.summary.addRaw(`**Date Format:** ${dateFormat}\n`);
    core.summary.addRaw(`**Skip Existing:** ${skipExisting}\n\n`);
    
    core.summary.addRaw(`**Total Flags Found:** ${allFlags.length}\n`);
    core.summary.addRaw(`**Flags Skipped:** ${flagsSkipped.length}\n`);
    core.summary.addRaw(`**Flags Processed:** ${results.totalProcessed}\n`);
    core.summary.addRaw(`**Successfully Updated:** ${results.updatedFlags.length}\n`);
    core.summary.addRaw(`**Failed:** ${results.failedFlags.length}\n\n`);

    if (results.updatedFlags.length > 0) {
      core.summary.addHeading('Successfully Updated Flags', 3);
      const updatedTable = [['Flag Key', 'Flag Name', 'Creation Date', 'Expiry Date']];
      results.updatedFlags.forEach(flag => {
        updatedTable.push([flag.key, flag.name, flag.creationDate, flag.calculatedExpiryDate]);
      });
      core.summary.addTable(updatedTable);
    }

    if (flagsSkipped.length > 0) {
      core.summary.addHeading('Skipped Flags', 3);
      const skippedTable = [['Flag Key', 'Flag Name', 'Reason']];
      flagsSkipped.slice(0, 20).forEach(flag => { // Limit to first 20 for readability
        skippedTable.push([flag.key, flag.name, flag.reason]);
      });
      core.summary.addTable(skippedTable);
      
      if (flagsSkipped.length > 20) {
        core.summary.addRaw(`\n*Showing first 20 of ${flagsSkipped.length} skipped flags*\n`);
      }
    }

    if (results.failedFlags.length > 0) {
      core.summary.addHeading('Failed Flags', 3);
      const failedTable = [['Flag Key', 'Error']];
      results.failedFlags.forEach(flag => {
        failedTable.push([flag.key, flag.error]);
      });
      core.summary.addTable(failedTable);
    }

    await core.summary.write();

    // Fail the action if any flags failed to update
    if (results.failedFlags.length > 0) {
      core.setFailed(`Failed to update ${results.failedFlags.length} out of ${results.totalProcessed} flags`);
    }

  } catch (error) {
    core.error('Action execution failed', error);
    
    // Provide specific error context based on error type
    if (error.message.includes('LaunchDarkly API request failed')) {
      core.setFailed(`LaunchDarkly API Error: ${error.message}`);
    } else if (error.message.includes('MODULE_NOT_FOUND')) {
      core.setFailed(`Dependency Error: ${error.message}`);
    } else {
      core.setFailed(`Action failed with error: ${error.message}`);
    }
  }
}

/**
 * Fetch all feature flags from LaunchDarkly API with throttling and progress tracking
 */
async function getAllFeatureFlagsWithThrottling(apiKey, projectKey) {
  const flags = [];
  let offset = 0;
  const limit = 50; // LaunchDarkly API default
  let totalCount = null;

  core.info('🔍 Fetching all feature flags from LaunchDarkly...');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Add delay between requests (except first) to prevent rate limiting
      if (offset > 0) {
        await sleep(RATE_LIMIT_DELAY);
      }

      const url = `https://app.launchdarkly.com/api/v2/flags/${projectKey}?limit=${limit}&offset=${offset}`;
      
      core.debug(`Fetching flags: offset=${offset}, limit=${limit}`);
      const response = await fetchWithRetry(url, {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      // Track progress for large datasets
      if (totalCount === null && data.totalCount) {
        totalCount = data.totalCount;
        core.info(`📊 Found ${totalCount} total flags to process`);
      }
      
      if (data.items && data.items.length > 0) {
        flags.push(...data.items);
        offset += limit;
        
        // Progress logging
        const progress = totalCount ? `${flags.length}/${totalCount}` : flags.length;
        core.info(`📋 Retrieved ${progress} flags`);
        
        // If we got fewer items than the limit, we've reached the end
        if (data.items.length < limit) {
          core.debug(`Reached end of results (got ${data.items.length} < ${limit})`);
          break;
        }
      } else {
        core.debug('No items returned, ending pagination');
        break;
      }
    } catch (error) {
      throw new Error(`Failed to fetch flags at offset ${offset}: ${error.message}`);
    }
  }

  core.info(`✅ Successfully retrieved ${flags.length} total flags`);
  return flags;
}

/**
 * Get a specific feature flag from LaunchDarkly API
 */
async function getFeatureFlag(apiKey, projectKey, flagKey) {
  const url = `https://app.launchdarkly.com/api/v2/flags/${projectKey}/${flagKey}`;
  
  core.debug(`Fetching flag: ${flagKey}`);
  
  try {
    const response = await fetchWithRetry(url, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      }
    });

    return await response.json();
  } catch (error) {
    if (error.message.includes('HTTP 404')) {
      return null; // Flag not found
    }
    throw error;
  }
}

/**
 * Set a custom property on a feature flag
 */
async function setCustomProperty(apiKey, projectKey, flagKey, propertyName, propertyValue) {
  const url = `https://app.launchdarkly.com/api/v2/flags/${projectKey}/${flagKey}`;
  
  // Prepare the patch operation to set the custom property
  const patchData = {
    patch: [
      {
        op: 'replace',
        path: `/customProperties/${propertyName}`,
        value: {
          name: propertyName,
          value: [propertyValue]
        }
      }
    ]
  };

  core.debug(`Setting custom property ${propertyName} = ${propertyValue} on flag: ${flagKey}`);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'PATCH',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchData)
    });

    return await response.json();
  } catch (error) {
    // Add more context to the error
    if (error.message.includes('HTTP 401')) {
      throw new Error(`${error.message} Please check your API key has WRITE permissions.`);
    } else if (error.message.includes('HTTP 404')) {
      throw new Error(`${error.message} Flag '${flagKey}' may not exist in project '${projectKey}'.`);
    }
    
    throw error;
  }
}

/**
 * Calculate expiry date from creation date
 */
function calculateExpiryFromCreation(flag, daysFromCreation, dateFormat) {
  // Parse the Unix timestamp (milliseconds)
  const creationDate = new Date(flag.creationDate);
  
  // Validate the parsed date
  if (isNaN(creationDate.getTime())) {
    throw new Error(`Invalid creation date for flag ${flag.key}: ${flag.creationDate}`);
  }
  
  // Calculate expiry date
  const expiryDate = new Date(creationDate);
  expiryDate.setDate(creationDate.getDate() + daysFromCreation);
  
  // Format according to user preference
  return formatDateToString(expiryDate, dateFormat);
}

/**
 * Format Date object to string in specified format
 */
function formatDateToString(date, format) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (format.toUpperCase()) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    default:
      return `${month}/${day}/${year}`; // Default to MM/DD/YYYY
  }
}

/**
 * Filter flags that need expiry dates
 */
function filterFlagsNeedingExpiry(flags, customPropertyName, skipExisting) {
  const flagsToProcess = [];
  const flagsSkipped = [];
  
  core.info(`🔍 Filtering flags that need expiry dates...`);
  
  for (const flag of flags) {
    // Check if flag already has the custom property
    const hasExpiryProperty = flag.customProperties && 
                             flag.customProperties[customPropertyName] &&
                             flag.customProperties[customPropertyName].value &&
                             flag.customProperties[customPropertyName].value.length > 0;
    
    if (hasExpiryProperty && skipExisting) {
      flagsSkipped.push({
        key: flag.key,
        name: flag.name,
        reason: `Already has ${customPropertyName}`,
        existingValue: flag.customProperties[customPropertyName].value[0]
      });
      continue;
    }
    
    // Validate creation date
    if (!flag.creationDate || isNaN(new Date(flag.creationDate).getTime())) {
      flagsSkipped.push({
        key: flag.key,
        name: flag.name,
        reason: 'Invalid or missing creation date',
        creationDate: flag.creationDate
      });
      continue;
    }
    
    flagsToProcess.push(flag);
  }
  
  core.info(`📊 Filtering complete: ${flagsToProcess.length} to process, ${flagsSkipped.length} skipped`);
  return { flagsToProcess, flagsSkipped };
}

/**
 * Process a single flag - calculate and set expiry date
 */
async function processSingleFlag(flag, apiKey, projectKey, customPropertyName, daysFromCreation, dateFormat) {
  try {
    // Calculate expiry date from creation date
    const expiryDateString = calculateExpiryFromCreation(flag, daysFromCreation, dateFormat);
    const creationDate = new Date(flag.creationDate);
    
    // Set the custom property
    await setCustomProperty(apiKey, projectKey, flag.key, customPropertyName, expiryDateString);
    
    return {
      key: flag.key,
      name: flag.name,
      creationDate: creationDate.toISOString().split('T')[0],
      calculatedExpiryDate: expiryDateString,
      daysFromCreation: daysFromCreation,
      customPropertyName: customPropertyName
    };
  } catch (error) {
    throw new Error(`Failed to process flag ${flag.key}: ${error.message}`);
  }
}

/**
 * Process flags in batches to avoid overwhelming the API
 */
async function processFlagsInBatches(flagsToProcess, apiKey, projectKey, customPropertyName, daysFromCreation, dateFormat) {
  const results = {
    updatedFlags: [],
    failedFlags: [],
    totalProcessed: 0
  };
  
  if (flagsToProcess.length === 0) {
    core.info('📋 No flags to process');
    return results;
  }
  
  // Split flags into batches
  const batches = [];
  for (let i = 0; i < flagsToProcess.length; i += BATCH_SIZE) {
    batches.push(flagsToProcess.slice(i, i + BATCH_SIZE));
  }
  
  core.info(`🚀 Processing ${flagsToProcess.length} flags in ${batches.length} batches of ${BATCH_SIZE}`);
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    core.info(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} flags)`);
    
    // Process batch in parallel
    const batchPromises = batch.map(flag => 
      processSingleFlag(flag, apiKey, projectKey, customPropertyName, daysFromCreation, dateFormat)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Collect results
    batchResults.forEach((result, index) => {
      const flag = batch[index];
      results.totalProcessed++;
      
      if (result.status === 'fulfilled') {
        results.updatedFlags.push(result.value);
        core.info(`  ✅ ${flag.key}: ${result.value.calculatedExpiryDate}`);
      } else {
        // Better error handling - extract message safely
        let errorMessage;
        if (result.reason instanceof Error) {
          errorMessage = result.reason.message;
        } else if (typeof result.reason === 'string') {
          errorMessage = result.reason;
        } else if (result.reason && result.reason.message) {
          errorMessage = result.reason.message;
        } else {
          errorMessage = 'Unknown error occurred';
        }
        
        results.failedFlags.push({
          key: flag.key,
          name: flag.name,
          error: errorMessage
        });
        core.error(`  ❌ ${flag.key}: ${errorMessage}`);
      }
    });
    
    // Delay between batches (except last) to be respectful of rate limits
    if (batchIndex < batches.length - 1) {
      core.debug(`Waiting ${BATCH_DELAY}ms before next batch...`);
      await sleep(BATCH_DELAY);
    }
  }
  
  return results;
}

/**
 * Get today's date in the specified format
 */
function getTodaysDate(format) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  switch (format.toUpperCase()) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    default:
      // Default to MM/DD/YYYY
      return `${month}/${day}/${year}`;
  }
}

/**
 * Validate if a date string matches the expected format
 */
function isValidDateFormat(dateString, expectedFormat) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  const cleaned = dateString.trim();
  
  // Define regex patterns for each supported format
  const formatPatterns = {
    'MM/DD/YYYY': /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    'MM-DD-YYYY': /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    'YYYY-MM-DD': /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    'YYYY/MM/DD': /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
  };

  const pattern = formatPatterns[expectedFormat.toUpperCase()];
  if (!pattern) {
    core.warning(`Unsupported date format: ${expectedFormat}`);
    return false;
  }

  const match = cleaned.match(pattern);
  if (!match) {
    return false;
  }

  // Extract date components and validate
  let year, month, day;
  
  if (expectedFormat.toUpperCase().startsWith('MM')) {
    month = parseInt(match[1], 10);
    day = parseInt(match[2], 10);
    year = parseInt(match[3], 10);
  } else {
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10);
    day = parseInt(match[3], 10);
  }

  // Validate date components
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) {
    return false;
  }

  // Create date object to validate (handles leap years, invalid dates)
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
}

// Polyfill for fetch if not available
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

if (require.main === module) {
  run();
}

module.exports = { 
  run, 
  getAllFeatureFlagsWithThrottling,
  getFeatureFlag, 
  setCustomProperty, 
  getTodaysDate, 
  isValidDateFormat,
  calculateExpiryFromCreation,
  formatDateToString,
  filterFlagsNeedingExpiry,
  processSingleFlag,
  processFlagsInBatches,
  fetchWithRetry,
  sleep
};
