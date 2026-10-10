import { supabase } from '../lib/supabase'

export async function fetchForecastOverview() {
  const { data, error } = await supabase.from('forecast_overview').select('*')
  if (error) throw error
  return data
}

export async function fetchProductForecast(productId) {
  const { data, error } = await supabase
    .from('product_forecasts')
    .select('horizon_week, week_start, forecast_qty, low_qty, high_qty')
    .eq('product_id', productId)
    .order('horizon_week')
  if (error) throw error
  return data
}

export async function fetchSalesSince(productId, fromDate) {
  const { data, error } = await supabase
    .from('sales')
    .select('sale_date, quantity')
    .eq('product_id', productId)
    .gt('sale_date', fromDate)
  if (error) throw error
  return data
}

export async function refreshForecasts() {
  const { data, error } = await supabase.rpc('refresh_forecasts')
  if (error) throw error
  return data
}
