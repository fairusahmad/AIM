// maintenance.gs

/**
 * Deletes old data from RawData and SensorData sheets based on the retention period in Config.
 */
function cleanOldData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const retentionDays = getConfigValue('DataRetention_days');
  
  if (!retentionDays || retentionDays <= 0) {
    Logger.log('Data retention is not configured or is invalid. Skipping cleanup.');
    return;
  }

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  Logger.log(`Calculated cutoff date for data deletion: ${cutoffDate.toISOString()}`);

  const sheetsToClean = ['RawData', 'SensorData'];
  
  sheetsToClean.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log(`Sheet "${sheetName}" not found. Skipping.`);
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) { // Only header or empty
      Logger.log(`Sheet "${sheetName}" has no data to clean.`);
      return;
    }
    
    // Assuming Timestamp is in the first column (A) for both sheets
    const timestampColIndex = 0; 
    
    // Find rows to delete. We go backwards to avoid index shifting issues.
    let rowsDeleted = 0;
    for (let i = data.length - 1; i >= 1; i--) { // i=0 is the header
      const timestamp = new Date(data[i][timestampColIndex]);
      if (timestamp < cutoffDate) {
        sheet.deleteRow(i + 1);
        rowsDeleted++;
      }
    }
    
    if (rowsDeleted > 0) {
      Logger.log(`Deleted ${rowsDeleted} rows from ${sheetName}.`);
    } else {
      Logger.log(`No rows older than ${retentionDays} days found in ${sheetName}.`);
    }
  });

  Logger.log('Data cleanup process finished.');
}

/**
 * Sets up a weekly trigger for the cleanOldData function.
 */
function setupCleanupTrigger() {
  // Delete any existing triggers for this function to avoid duplicates
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of existingTriggers) {
    if (trigger.getHandlerFunction() === 'cleanOldData') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create a new trigger to run every Sunday at midnight
  ScriptApp.newTrigger('cleanOldData')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.SUNDAY)
      .atHour(0)
      .create();
      
  Logger.log('Weekly data cleanup trigger created for every Sunday at midnight.');
}
