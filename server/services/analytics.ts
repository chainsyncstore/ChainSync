import { storage } from "../storage";

/**
 * Get sales trend analysis data
 * @param storeId Optional store ID to filter by
 * @param startDate Optional start date to filter by
 * @param endDate Optional end date to filter by
 * @param groupBy How to group the data ('day', 'week', or 'month')
 * @returns Sales trend analysis data
 */
export async function getSalesTrendsAnalysis(
  storeId?: number, 
  startDate?: Date, 
  endDate?: Date, 
  groupBy: 'day' | 'week' | 'month' = 'day'
) {
  return await storage.getSalesTrends(storeId, startDate, endDate, groupBy);
}

/**
 * Get a formatted date range description
 * @param startDate Start date
 * @param endDate End date
 * @returns Formatted date range description
 */
export function getDateRangeDescription(startDate?: Date, endDate?: Date): string {
  if (!startDate && !endDate) {
    return 'All time';
  }
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC' // Ensuring consistent timezone
    });
  };
  
  if (startDate && endDate) {
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  }
  
  if (startDate) {
    return `From ${formatDate(startDate)}`;
  }
  
  return `Until ${formatDate(endDate!)}`;
}