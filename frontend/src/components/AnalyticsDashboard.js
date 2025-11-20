import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Calendar, DollarSign, Award, Activity, ArrowLeft, Download } from "lucide-react";
import { motion } from "framer-motion";

export default function AnalyticsDashboard({ token }) {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30"); // days
  const [selectedRevenueCategory, setSelectedRevenueCategory] = useState(null);
  const [categoryDetailRange, setCategoryDetailRange] = useState('');
  const [categoryDetailLoading, setCategoryDetailLoading] = useState(false);
  const [categoryDetailError, setCategoryDetailError] = useState('');
  const [categoryDetailData, setCategoryDetailData] = useState(null);
  const [detailCache, setDetailCache] = useState({});

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/analytics/dashboard?days=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    // Create CSV export
    const csvContent = generateCSVReport(analytics);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const generateCSVReport = (data) => {
    if (!data) return '';
    
    let csv = 'Event Analytics Report\n\n';
    csv += 'Summary Statistics\n';
    csv += `Total Events,${data.totalEvents || 0}\n`;
    csv += `Total Registrations,${data.totalRegistrations || 0}\n`;
    csv += `Total Revenue,${data.totalRevenue || 0}\n`;
    csv += `Active Users,${data.activeUsers || 0}\n\n`;
    
    csv += 'Category Breakdown\n';
    csv += 'Category,Count\n';
    (data.categoryData || []).forEach(item => {
      csv += `${item.name},${item.value}\n`;
    });
    csv += '\nCategory Revenue Details\n';
    csv += 'Category,Total Events,Total Registrations,Confirmed Registrations,Revenue\n';
    (data.categoryEventBreakdown || []).forEach(item => {
      csv += `${item.category},${item.categoryEvents},${item.totalRegistrations},${item.confirmedRegistrations},${item.categoryRevenue}\n`;
      (item.events || []).forEach((ev) => {
        csv += `  ${ev.title},${ev.totalRegistrations},${ev.confirmedRegistrations},${ev.revenue}\n`;
      });
    });
    
    return csv;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6'];
  const detailRangeOptions = [
    { label: 'Last 7 days', value: '7' },
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
    { label: 'Last year', value: '365' }
  ];
  const revenueCategories = analytics?.revenueByCategory || [];
  const categoryBreakdown = analytics?.categoryEventBreakdown || [];
  const formatShortDate = (value) => {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(value));
    } catch {
      return '—';
    }
  };
  const formatLocalizedCurrency = (value) => `₹${Number(value || 0).toLocaleString()}`;
  const selectedCategoryDetail = selectedRevenueCategory && categoryDetailRange && categoryDetailData
    ? (categoryDetailData.categoryEventBreakdown || []).find(
        (item) => item.category === selectedRevenueCategory
      )
    : null;

  const handleRevenueCategorySelect = (category) => {
    if (selectedRevenueCategory === category) {
      setSelectedRevenueCategory(null);
      setCategoryDetailRange('');
      setCategoryDetailData(null);
      setCategoryDetailError('');
      return;
    }
    setSelectedRevenueCategory(category);
    setCategoryDetailRange('');
    setCategoryDetailData(null);
    setCategoryDetailError('');
  };

  const handleCategoryRangeSelect = async (rangeValue) => {
    if (!selectedRevenueCategory) return;
    setCategoryDetailRange(rangeValue);
    setCategoryDetailError('');
    setCategoryDetailData(null);
    setCategoryDetailLoading(true);
    try {
      let dataset = detailCache[rangeValue];
      if (!dataset) {
        const res = await fetch(`http://localhost:5000/api/analytics/dashboard?days=${rangeValue}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch category details');
        dataset = await res.json();
        setDetailCache((prev) => ({ ...prev, [rangeValue]: dataset }));
      }
      setCategoryDetailData(dataset);
    } catch (error) {
      console.error('Category detail fetch error:', error);
      setCategoryDetailError('Unable to load category details. Please try again.');
    } finally {
      setCategoryDetailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 sm:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <button 
          onClick={() => navigate(-1)} 
          className="group flex items-center gap-2 text-purple-600 hover:text-purple-700 font-semibold mb-6 transition-all hover:gap-3"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </button>
        
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 shadow-2xl text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Activity className="w-8 h-8" />
              </div>
              <div>
                <p className="text-purple-200 text-sm font-medium">Admin Analytics</p>
                <h1 className="text-3xl sm:text-4xl font-bold">Event Insights</h1>
              </div>
            </div>
            
            <div className="flex gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="7" className="text-gray-900">Last 7 days</option>
                <option value="30" className="text-gray-900">Last 30 days</option>
                <option value="90" className="text-gray-900">Last 90 days</option>
                <option value="365" className="text-gray-900">Last year</option>
              </select>
              
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition-all"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +12%
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Events</p>
            <p className="text-3xl font-bold text-gray-900">{analytics?.totalEvents || 0}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +24%
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Registrations</p>
            <p className="text-3xl font-bold text-gray-900">{analytics?.totalRegistrations || 0}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +18%
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900">₹{analytics?.totalRevenue?.toLocaleString() || 0}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +8%
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-1">Active Users</p>
            <p className="text-3xl font-bold text-gray-900">{analytics?.activeUsers || 0}</p>
          </motion.div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Registration Trends */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Registration Trends</h3>
                <p className="text-sm text-gray-500">Daily registration activity</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics?.registrationTrends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="registrations" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Category Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Category Distribution</h3>
                <p className="text-sm text-gray-500">Events by category</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics?.categoryData || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(analytics?.categoryData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Category */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Revenue by Category</h3>
                <p className="text-sm text-gray-500">Income breakdown</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.revenueByCategory || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="category" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar
                  dataKey="revenue"
                  fill="#10B981"
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => handleRevenueCategorySelect(data?.payload?.category)}
                />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top Events */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Top Performing Events</h3>
                <p className="text-sm text-gray-500">Most popular events</p>
              </div>
            </div>
            <div className="space-y-4">
              {(analytics?.topEvents || []).slice(0, 5).map((event, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{event.title}</p>
                      <p className="text-xs text-gray-600">{event.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-purple-600">{event.registrations}</p>
                    <p className="text-xs text-gray-500">registrations</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Category insights with per-event metrics */}
      {revenueCategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="max-w-7xl mx-auto space-y-6"
        >
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Category Revenue Insights</h3>
                <p className="text-sm text-gray-500">
                  Click a category, pick a timeframe, and drill into event-level revenue. Without any selections, only the overall chart is shown.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
              {revenueCategories.map((category) => (
                <button
                  key={category.category}
                  onClick={() => handleRevenueCategorySelect(category.category)}
                  className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                    selectedRevenueCategory === category.category
                      ? 'bg-purple-600 text-white border-purple-600 shadow-lg'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                  }`}
                >
                  {category.category || 'Uncategorized'} · {formatLocalizedCurrency(category.revenue)}
                </button>
              ))}
            </div>

            {selectedRevenueCategory ? (
              <div className="mt-6">
                <p className="text-sm text-gray-500 mb-3">
                  Choose a time range to load details for <span className="font-semibold text-gray-900">{selectedRevenueCategory}</span>.
                </p>
                <div className="flex flex-wrap gap-3">
                  {detailRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleCategoryRangeSelect(option.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        categoryDetailRange === option.value
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-6">Select a category above to view its breakdown.</p>
            )}

            <div className="mt-6">
              {categoryDetailLoading && (
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="h-5 w-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                  Loading category insights...
                </div>
              )}
              {!categoryDetailLoading && categoryDetailError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {categoryDetailError}
                </div>
              )}
              {!categoryDetailLoading && !categoryDetailError && selectedRevenueCategory && !categoryDetailRange && (
                <p className="text-sm text-gray-500">Select a timeframe above to view details.</p>
              )}
              {!categoryDetailLoading && !categoryDetailError && selectedRevenueCategory && categoryDetailRange && !selectedCategoryDetail && (
                <p className="text-sm text-gray-500">No events found for this category and timeframe.</p>
              )}

              {!categoryDetailLoading && !categoryDetailError && selectedCategoryDetail && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                      <p className="text-xs text-purple-500 uppercase tracking-wide mb-1">Revenue</p>
                      <p className="text-2xl font-bold text-purple-700">{formatLocalizedCurrency(selectedCategoryDetail.categoryRevenue)}</p>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                      <p className="text-xs text-green-500 uppercase tracking-wide mb-1">Confirmed</p>
                      <p className="text-2xl font-bold text-green-700">{selectedCategoryDetail.confirmedRegistrations || 0}</p>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                      <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">Total Registrations</p>
                      <p className="text-2xl font-bold text-blue-700">{selectedCategoryDetail.totalRegistrations || 0}</p>
                    </div>
                    <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
                      <p className="text-xs text-yellow-600 uppercase tracking-wide mb-1">Events</p>
                      <p className="text-2xl font-bold text-yellow-700">{selectedCategoryDetail.categoryEvents || 0}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 uppercase tracking-wider">
                          <th className="py-2 pr-4">Event</th>
                          <th className="py-2 pr-4">Revenue</th>
                          <th className="py-2 pr-4">Confirmed</th>
                          <th className="py-2 pr-4">Total</th>
                          <th className="py-2 pr-4">Start Date</th>
                          <th className="py-2 pr-4">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(selectedCategoryDetail.events || []).map((event) => (
                          <tr key={event.eventId}>
                            <td className="py-3 pr-4 font-medium text-gray-900">{event.title}</td>
                            <td className="py-3 pr-4 text-gray-700">{formatLocalizedCurrency(event.revenue)}</td>
                            <td className="py-3 pr-4 text-gray-700">{event.confirmedRegistrations || 0}</td>
                            <td className="py-3 pr-4 text-gray-500">{event.totalRegistrations || 0}</td>
                            <td className="py-3 pr-4 text-gray-500">{formatShortDate(event.startAt)}</td>
                            <td className="py-3 pr-4">
                              {event.isPaid ? (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                  Paid • {event.price ? formatLocalizedCurrency(event.price) : '—'}
                                </span>
                              ) : (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                                  Free
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
