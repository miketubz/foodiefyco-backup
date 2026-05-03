import gcashQr from '../../pix/gcashqr.png';
import gotymeQr from '../../pix/nicogotyme.jpg';
import unionbankQr from '../../pix/unionbankqr.jpg';

const paymentQrMap = {
  GCASH: gcashQr,
  GOtyme: gotymeQr,
  UnionBank: unionbankQr,
};

function Cart({
  cartItems,
  onClose,
  onRemove,
  onPlaceOrder,
  onApplyPromo,
  customerName,
  setCustomerName,
  phoneNumber,
  setPhoneNumber,
  deliveryAddress,
  setDeliveryAddress,
  specialInstructions,
  setSpecialInstructions,
  paymentMethod,
  setPaymentMethod,
  promoCode,
  setPromoCode,
  paymentProofOption,
  setPaymentProofOption,
  paymentProofFile,
  setPaymentProofFile,
  discountAmount = 0,
  subtotal = 0,
  isSubmitting = false,
  isApplyingPromo = false,
  promoMessage = '',
  promoError = '',
}) {
  const finalTotal = Math.max(0, Number(subtotal) - Number(discountAmount || 0));

  const isFormValid =
    cartItems.length > 0 &&
    customerName.trim() &&
    phoneNumber.trim() &&
    deliveryAddress.trim() &&
    paymentMethod;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b bg-orange-500 px-5 py-4 text-white">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.837L5.82 8.25m0 0h12.87c.923 0 1.635.816 1.51 1.73l-.795 5.565a1.5 1.5 0 01-1.486 1.305H8.24a1.5 1.5 0 01-1.486-1.305L5.82 8.25zM5.82 8.25L5.094 4.44M9.75 20.25a.75.75 0 100-1.5.75.75 0 000 1.5zm8.25 0a.75.75 0 100-1.5.75.75 0 000 1.5z"
              />
            </svg>
            <span>Your Cart</span>
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting || isApplyingPromo}
            className="text-2xl font-bold disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-gray-300 px-3 py-2"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Phone Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="09XXXXXXXXX"
                className="w-full rounded-xl border border-gray-300 px-3 py-2"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Delivery Address
              </label>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="House no., street, barangay, city"
                className="w-full rounded-xl border border-gray-300 px-3 py-2"
                rows="3"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Special Instructions
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="No onions, extra spicy, call on arrival, etc."
                className="w-full rounded-xl border border-gray-300 px-3 py-2"
                rows="3"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['COD', 'GCASH', 'GOtyme', 'UnionBank'].map((method) => {
                  const isSelected = paymentMethod === method;

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      disabled={isSubmitting}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      } disabled:opacity-50`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>

              {paymentMethod !== 'COD' && paymentQrMap[paymentMethod] && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 text-center text-sm font-medium text-gray-700">
                    Scan to pay with {paymentMethod}
                  </p>
                  <img
                    src={paymentQrMap[paymentMethod]}
                    alt={`${paymentMethod} QR`}
                    className="mx-auto h-56 w-56 rounded-xl object-contain"
                  />
                </div>
              )}

              {paymentMethod !== 'COD' && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-gray-700">
                    Proof of Payment
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPaymentProofOption('upload_now')}
                      disabled={isSubmitting || isApplyingPromo}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                        paymentProofOption === 'upload_now'
                          ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Upload now
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentProofOption('scan_on_delivery');
                        setPaymentProofFile(null);
                      }}
                      disabled={isSubmitting || isApplyingPromo}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                        paymentProofOption === 'scan_on_delivery'
                          ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Scan upon delivery
                    </button>
                  </div>

                  {paymentProofOption === 'upload_now' && (
                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Upload receipt screenshot
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isSubmitting || isApplyingPromo}
                        onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                        className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                      />
                      {paymentProofFile && (
                        <p className="mt-2 text-sm text-green-600">
                          Selected: {paymentProofFile.name}
                        </p>
                      )}
                    </div>
                  )}

                  {paymentProofOption === 'scan_on_delivery' && (
                    <p className="mt-3 text-sm text-gray-500">
                      Customer will pay by scanning when the order is delivered.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Promo Code
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Enter promo code"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 uppercase"
                  disabled={isSubmitting || isApplyingPromo}
                />
                <button
                  type="button"
                  onClick={onApplyPromo}
                  disabled={isSubmitting || isApplyingPromo || !promoCode.trim()}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isApplyingPromo ? 'Applying...' : 'Apply'}
                </button>
              </div>

              {promoMessage && (
                <p className="mt-2 text-sm font-medium text-green-600">
                  {promoMessage}
                </p>
              )}

              {promoError && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {promoError}
                </p>
              )}

              <p className="mt-2 text-xs text-gray-500">
                Follow us on Facebook for gifts and codes
              </p>
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Order Items
            </h3>

            {cartItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-gray-400">
                Your cart is empty
              </p>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between rounded-xl border border-gray-200 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        x{item.quantity} — ₱{(Number(item.price) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemove(item)}
                      disabled={isSubmitting}
                      className="text-lg font-bold text-red-500 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t bg-white px-5 py-4 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>₱{Number(subtotal).toFixed(2)}</span>
          </div>

          <div className="mb-2 flex items-center justify-between text-sm text-green-600">
            <span>Discount</span>
            <span>-₱{Number(discountAmount).toFixed(2)}</span>
          </div>

          <div className="mb-4 flex items-center justify-between text-lg font-bold text-gray-900">
            <span>Total</span>
            <span>₱{finalTotal.toFixed(2)}</span>
          </div>

          <button
            onClick={onPlaceOrder}
            disabled={!isFormValid || isSubmitting || isApplyingPromo}
            className="w-full rounded-2xl bg-orange-500 py-3 font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Cart;
