import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, AlertCircle, Smartphone, Wallet, Banknote } from 'lucide-react';
import { formatDate } from '../utils/dateFormat';

const TRANSACTION_RULES = {
  GPay: {
    pattern: /^GPA\.[A-Z0-9]{10,}$/,
    hint: 'Format: GPA.1234ABCD5678 (from GPay app)'
  },
  PhonePe: {
    pattern: /^PPE[A-Z0-9]{10,}$/,
    hint: 'Format: PPE1234567890ABCD (from PhonePe app)'
  },
  Paytm: {
    pattern: /^PTM[A-Z0-9]{10,}$/,
    hint: 'Format: PTM1234567890ABCD (from Paytm app)'
  },
  Card: {
    pattern: /^[A-Z0-9]{12,}$/,
    hint: 'Format: Last 12+ digits of your card transaction ID'
  },
};

export default function PaymentPage({ token }) {
  const location = useLocation();
  const navigate = useNavigate();
  const event = location.state?.event;
  
  const [contactInfo, setContactInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  if (!event) {
    navigate('/dashboard');
    return null;
  }

  const paymentMethods = [
    { id: 'GPay', name: 'Google Pay', icon: Smartphone, color: 'from-green-500 to-green-600' },
    { id: 'PhonePe', name: 'PhonePe', icon: Wallet, color: 'from-purple-500 to-purple-600' },
    { id: 'Paytm', name: 'Paytm', icon: CreditCard, color: 'from-blue-500 to-blue-600' },
    { id: 'Card', name: 'Card Payment', icon: CreditCard, color: 'from-indigo-500 to-indigo-600' },
    { id: 'Cash', name: 'Cash on Event', icon: Banknote, color: 'from-yellow-500 to-yellow-600' },
  ];

  const currentRule = selectedPaymentMethod ? TRANSACTION_RULES[selectedPaymentMethod] : null;
  const normalizeTransactionId = (value = '') => value.trim().toUpperCase();
  const isTransactionIdValid = (value = '') => {
    if (!selectedPaymentMethod || !currentRule) return false;
    return currentRule.pattern.test(normalizeTransactionId(value));
  };

  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
    setTransactionId('');
    setErrorMessage('');
    setStatusMessage('');
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (!selectedPaymentMethod) {
      setErrorMessage('Please select a payment method');
      return;
    }

    // Validate contact info
    if (!contactInfo.fullName || !contactInfo.email || 
        !contactInfo.phone || !contactInfo.address) {
      setErrorMessage('Please fill all contact information');
      return;
    }

    // For digital payments, validate transaction ID
    if (selectedPaymentMethod !== 'Cash') {
      if (!transactionId) {
        setErrorMessage(`Transaction ID is required for ${selectedPaymentMethod} payments`);
        return;
      }
      if (!isTransactionIdValid(transactionId)) {
        setErrorMessage(`Invalid transaction ID format. ${currentRule.hint}`);
        return;
      }
    }

    try {
      setLoading(true);
      const normalizedTransactionId = selectedPaymentMethod !== 'Cash'
        ? normalizeTransactionId(transactionId)
        : undefined;

      const res = await fetch(
        `http://localhost:5000/api/payments/register-paid-event/${event._id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            paymentMethod: selectedPaymentMethod,
            transactionId: normalizedTransactionId,
            contactInfo
          })
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Payment failed');
        return;
      }

      if (data.msg) {
        setSuccess(true);
        setStatusMessage(data.msg);
        setErrorMessage('');
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } else {
        setErrorMessage(data.error || 'Payment failed');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {success && (
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 mb-6 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
            <div>
              <h3 className="text-xl font-bold text-emerald-900">Payment Successful!</h3>
              <p className="text-emerald-700">{statusMessage}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-semibold">Payment Error</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center mb-2">
              <CreditCard className="w-6 h-6 mr-2" />
              <h1 className="text-2xl font-bold">Complete Payment</h1>
            </div>
            <p className="text-purple-100">Secure event registration payment</p>
          </div>

          {/* Event Details */}
          <div className="bg-purple-50 p-6 border-b border-purple-100">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h2>
            <p className="text-gray-600 mb-3">{event.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Event Date:</span>
              <span className="font-semibold">
                {formatDate(event.startAt, { fallback: '—' })}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-3 border-t border-purple-200">
              <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
              <span className="text-3xl font-bold text-purple-600">
                {event.currency === 'INR' ? '₹' : event.currency} {event.price}
              </span>
            </div>
          </div>

          <form onSubmit={handlePayment} className="p-6 space-y-6">
            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-purple-100 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center mr-2 text-sm font-bold">1</span>
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={contactInfo.fullName}
                    onChange={(e) => setContactInfo({...contactInfo, fullName: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    placeholder="your.email@example.com"
                    value={contactInfo.email}
                    onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={contactInfo.phone}
                    onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                  <input
                    type="text"
                    placeholder="Your address"
                    value={contactInfo.address}
                    onChange={(e) => setContactInfo({...contactInfo, address: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-purple-100 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center mr-2 text-sm font-bold">2</span>
                Select Payment Method
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  const isSelected = selectedPaymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => handlePaymentMethodSelect(method.id)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? `border-purple-500 bg-gradient-to-br ${method.color} text-white shadow-lg`
                          : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:shadow-md'
                      }`}
                    >
                      <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                      <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                        {method.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transaction ID Input (for digital payments) */}
            {selectedPaymentMethod && selectedPaymentMethod !== 'Cash' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="bg-purple-100 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center mr-2 text-sm font-bold">3</span>
                  Transaction Details
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction ID *
                  </label>
                  <input
                    type="text"
                    placeholder={`Enter ${selectedPaymentMethod} transaction ID`}
                    value={transactionId}
                    onChange={(e) => {
                      setTransactionId(e.target.value.toUpperCase());
                      setErrorMessage('');
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                    required
                  />
                  {currentRule && (
                    <p className="text-xs text-gray-500 mt-2">
                      {currentRule.hint}
                    </p>
                  )}
                  <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">How to get Transaction ID:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Open {selectedPaymentMethod} app</li>
                          <li>Complete payment of ₹{event.price}</li>
                          <li>Copy the Transaction ID from payment confirmation</li>
                          <li>Paste it in the field above</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cash Payment Info */}
            {selectedPaymentMethod === 'Cash' && (
              <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
                <div className="flex items-start">
                  <Banknote className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-2 text-lg">Cash Payment at Event</p>
                    <p className="mb-2">You can pay ₹{event.price} in cash when you arrive at the event.</p>
                    <p className="font-medium">Your registration will be marked as pending until payment is received at the venue.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={loading || success || !selectedPaymentMethod}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-6 rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : success ? (
                  'Payment Successful!'
                ) : selectedPaymentMethod ? (
                  `Complete Payment - ${event.currency === 'INR' ? '₹' : event.currency}${event.price}`
                ) : (
                  'Select Payment Method First'
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="w-full mt-3 bg-gray-100 text-gray-700 font-medium py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
