/** ??????? */
import * as aStock from "./a-stock";

const vendor: any = aStock;

export async function getStockData(symbol: string, startDate: string, endDate: string): Promise<string> { return vendor.getStockData(symbol, startDate, endDate); }
export async function getIndicators(symbol: string, indicator: string, currDate: string, lookBackDays: number): Promise<string> { return vendor.getIndicators(symbol, indicator, currDate, lookBackDays); }
export async function getFundamentals(ticker: string, currDate?: string): Promise<string> { return vendor.getFundamentals(ticker, currDate); }
export async function getBalanceSheet(ticker: string, freq?: string, currDate?: string): Promise<string> { return vendor.getBalanceSheet(ticker, freq, currDate); }
export async function getCashflow(ticker: string, freq?: string, currDate?: string): Promise<string> { return vendor.getCashflow(ticker, freq, currDate); }
export async function getIncomeStatement(ticker: string, freq?: string, currDate?: string): Promise<string> { return vendor.getIncomeStatement(ticker, freq, currDate); }
export async function getNews(ticker: string, startDate: string, endDate: string): Promise<string> { return vendor.getNews(ticker, startDate, endDate); }
export async function getGlobalNews(currDate: string, lookBackDays?: number, limit?: number): Promise<string> { return vendor.getGlobalNews(currDate, lookBackDays, limit); }
export async function getInsiderTransactions(ticker: string): Promise<string> { return vendor.getInsiderTransactions(ticker); }
export async function getProfitForecast(ticker: string, currDate?: string): Promise<string> { return vendor.getProfitForecast(ticker, currDate); }
export async function getHotStocks(currDate?: string): Promise<string> { return vendor.getHotStocks(currDate); }
export async function getNorthboundFlow(currDate: string, includeHistory?: boolean): Promise<string> { return vendor.getNorthboundFlow(currDate, includeHistory); }
export async function getConceptBlocks(ticker: string): Promise<string> { return vendor.getConceptBlocks(ticker); }
export async function getFundFlow(ticker: string, currDate: string, includeHistory?: boolean): Promise<string> { return vendor.getFundFlow(ticker, currDate, includeHistory); }
export async function getDragonTigerBoard(ticker: string, tradeDate: string, lookBackDays?: number): Promise<string> { return vendor.getDragonTigerBoard(ticker, tradeDate, lookBackDays); }
export async function getLockupExpiry(ticker: string, tradeDate: string, forwardDays?: number): Promise<string> { return vendor.getLockupExpiry(ticker, tradeDate, forwardDays); }
export async function getIndustryComparison(ticker: string, tradeDate: string, topN?: number): Promise<string> { return vendor.getIndustryComparison(ticker, tradeDate, topN); }