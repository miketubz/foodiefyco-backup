import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MenuCard from '../components/MenuCard';
import Cart from '../components/Cart';
import { useMenuItems } from '../hooks/useMenuItems';
import { supabase } from '../lib/supabaseClient.js';

function FrontendPage() {
  const { menuItems, loading, error } = useMenuItems();
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [promoCode, setPromoCode] = useState('');

  const [paymentProofOption, setPaymentProofOption] = useState('upload_now');
  const [paymentProofFile, setPaymentProofFile] = useState(null);

  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  const [promoMessage, setPromoMessage] = useState('');
  const [promoError, setPromoError] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      ),
    [cartItems]
  );

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        (menuItems || [])
          .map((item) => (item.category || '').trim())
          .filter(Boolean)
      )
    );

    return uniqueCategories.sort((a, b) => a.localeCompare(b));
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (menuItems || []).filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' || (item.category || '') === selectedCategory;

      const searchableText = [item.name, item.category, item.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [menuItems, searchTerm, selectedCategory]);

  useEffect(() => {
    setDiscountAmount(0);
    setPromoMessage('');
    setPromoError('');
  }, [promoCode, subtotal]);

  useEffect(() => {
    if (paymentMethod === 'COD') {
      setPaymentProofOption('upload_now');
      setPaymentProofFile(null);
    }
  }, [paymentMethod]);

  const isPlaceholderValue = (value) => {
    const normalized = value.trim().toLowerCase().replace(/\./g, '');
    return ['n/a', 'na', 'none', 'unknown', '-'].includes(normalized);
  };

  const isValidPhoneNumber = (value) => {
    if (!value.trim() || isPlaceholderValue(value)) return false;
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7;
  };

  const isValidAddress = (value) => {
    if (!value.trim() || isPlaceholderValue(value)) return false;
    return value.trim().length >= 5;
  };

  const handleAddToCart = (item) => {
    setCartItems((prev) => {
      const existingItem = prev.find((cartItem) => cartItem.id === item.id);

      if (existingItem) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }

      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (itemToRemove) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === itemToRemove.id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const normalizePromoResult = (data) => {
    const raw = Array.isArray(data) ? data[0] : data;

    if (!raw) {
      return {
        valid: false,
        discount_amount: 0,
        message: 'Promo code is invalid.',
      };
    }

    return {
      valid: raw.valid ?? raw.is_valid ?? false,
      discount_amount: Number(raw.discount_amount ?? raw.discount ?? 0),
      message: raw.message ?? '',
    };
  };

  const validatePromoCode = async (normalizedPromo) => {
    if (!normalizedPromo) {
      return { valid: true, discount_amount: 0, message: '' };
    }

    const { data, error } = await supabase.rpc('validate_promo_code', {
      input_code: normalizedPromo,
      order_subtotal: subtotal,
    });

    if (error) {
      throw new Error(error.message);
    }

    return normalizePromoResult(data);
  };

  const handleApplyPromo = async () => {
    const normalizedPromo = promoCode.trim().toUpperCase();

    setPromoMessage('');
    setPromoError('');
    setOrderError('');

    if (!normalizedPromo) {
      setDiscountAmount(0);
      setPromoError('Enter a promo code first.');
      return;
    }

    setIsApplyingPromo(true);

    try {
      const promoResult = await validatePromoCode(normalizedPromo);

      if (!promoResult.valid) {
        setDiscountAmount(0);
        setPromoError(promoResult.message || 'Promo code is invalid.');
        setIsApplyingPromo(false);
        return;
      }

      setDiscountAmount(Number(promoResult.discount_amount || 0));
      setPromoMessage(
        `Promo code applied. Discount: ₱${Number(
          promoResult.discount_amount || 0
        ).toFixed(2)}`
      );
    } catch (err) {
      setDiscountAmount(0);
      setPromoError(`Promo code validation failed: ${err.message}`);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const uploadPaymentProof = async () => {
    if (!paymentProofFile) return '';

    const fileExt = paymentProofFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const folder = paymentMethod.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filePath = `${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, paymentProofFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Payment proof upload failed: ${error.message}`);
    }

    return filePath;
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || isSubmitting) return;

    setOrderError('');
    setOrderConfirmation(null);

    if (!customerName.trim()) {
      setOrderError('Please enter your name.');
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      setOrderError('Please enter a valid phone number.');
      return;
    }

    if (!isValidAddress(deliveryAddress)) {
      setOrderError('Please enter a valid delivery address.');
      return;
    }

    if (!paymentMethod) {
      setOrderError('Please select a payment method.');
      return;
    }

    if (
      paymentMethod !== 'COD' &&
      paymentProofOption === 'upload_now' &&
      !paymentProofFile
    ) {
      setOrderError('Please upload proof of payment or choose scan upon delivery.');
      return;
    }

    setIsSubmitting(true);
    let uploadedProofPath = '';

    try {
      const normalizedPromo = promoCode.trim().toUpperCase();
      const promoResult = await validatePromoCode(normalizedPromo);

      if (!promoResult?.valid) {
        setOrderError(promoResult?.message || 'Promo code is invalid.');
        setIsSubmitting(false);
        return;
      }

      const appliedDiscount = Number(promoResult?.discount_amount || 0);
      const totalAfterDiscount = Math.max(0, subtotal - appliedDiscount);

      setDiscountAmount(appliedDiscount);

      if (paymentMethod !== 'COD' && paymentProofOption === 'upload_now') {
        uploadedProofPath = await uploadPaymentProof();
      }

      const { data: orderData, error: orderErrorResponse } = await supabase
        .from('orders')
        .insert([
          {
            customer_name: customerName.trim(),
            phone_number: phoneNumber.trim(),
            delivery_address: deliveryAddress.trim(),
            special_instructions: specialInstructions.trim(),
            payment_method: paymentMethod,
            promo_code: normalizedPromo || null,
            discount_amount: appliedDiscount,
            total_amount: totalAfterDiscount,
            status: 'pending',
            payment_proof_option: paymentMethod === 'COD' ? null : paymentProofOption,
            payment_proof_path: uploadedProofPath || null,
          },
        ])
        .select()
        .single();

      if (orderErrorResponse) {
        if (uploadedProofPath) {
          await supabase.storage.from('payment-proofs').remove([uploadedProofPath]);
        }

        setOrderError(`Failed to place order: ${orderErrorResponse.message}`);
        setIsSubmitting(false);
        return;
      }

      const orderItemsPayload = cartItems.map((item) => ({
        order_id: orderData.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: Number(item.price),
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsPayload);

      if (itemsError) {
        setOrderError(
          `Order was created, but saving items failed: ${itemsError.message}`
        );
        setIsSubmitting(false);
        return;
      }

      setOrderConfirmation({
        orderId: orderData.id,
        name: customerName.trim(),
        phone: phoneNumber.trim(),
        address: deliveryAddress.trim(),
        specialInstructions: specialInstructions.trim(),
        paymentMethod,
        paymentProofOption:
          paymentMethod === 'COD'
            ? 'Not required'
            : paymentProofOption === 'upload_now'
            ? 'Upload now'
            : 'Scan upon delivery',
        paymentProofUploaded:
          paymentMethod !== 'COD' &&
          paymentProofOption === 'upload_now' &&
          Boolean(uploadedProofPath),
        promoCode: normalizedPromo || 'None',
        discountAmount: appliedDiscount,
        subtotal,
        total: totalAfterDiscount,
        itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        items: cartItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          subtotal: Number(item.price) * item.quantity,
        })),
      });

      setCartItems([]);
      setIsCartOpen(false);
      setCustomerName('');
      setPhoneNumber('');
      setDeliveryAddress('');
      setSpecialInstructions('');
      setPaymentMethod('COD');
      setPromoCode('');
      setDiscountAmount(0);
      setPromoMessage('');
      setPromoError('');
      setPaymentProofOption('upload_now');
      setPaymentProofFile(null);
      setIsSubmitting(false);
    } catch (err) {
      if (uploadedProofPath) {
        await supabase.storage.from('payment-proofs').remove([uploadedProofPath]);
      }

      setOrderError(err.message || 'Failed to place order.');
      setIsSubmitting(false);
    }
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-gray-50">
      <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section
          className="relative mb-8 overflow-hidden rounded-[2rem] px-6 py-10 text-white shadow-lg sm:px-10 sm:py-14"
          style={{
            backgroundImage: "url('https://ieqpalamjvxxwxjupwnv.supabase.co/storage/v1/object/public/food-images/header2.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-black/45" />

          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-orange-100">
              Food delivered to your door
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Fresh comfort food for every craving.
            </h1>
            <p className="mt-4 text-sm text-orange-50 sm:text-base">
              Choose from our best-selling dishes, place your order in minutes,
              and enjoy fast local delivery.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/gallery"
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                View Gallery
              </Link>

              <a
                href="https://www.facebook.com/foodiefyco/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1877F2] shadow-sm transition hover:bg-orange-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6h1.7V4.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H8v3h2.4v8h3.1Z" />
                </svg>
                Visit our Facebook page
              </a>
            </div>
          </div>
        </section>

        {orderError && (
          <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
            {orderError}
          </div>
        )}

        <section className="mb-6 flex justify-center px-4 text-center">
          <div className="w-full max-w-2xl">
            <p className="mb-2 text-lg font-bold uppercase tracking-[0.28em] text-orange-500 sm:text-xl">
              Our Menu
            </p>
            <h2 className="mx-auto max-w-md text-2xl font-bold tracking-tight text-gray-900 sm:max-w-none sm:text-3xl">
              Choose your favorites
            </h2>
          </div>
        </section>

        <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Search menu
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by item name, category, or description"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div className="text-sm text-gray-500 md:text-right">
              Showing {filteredMenuItems.length} of {menuItems.length} items
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                selectedCategory === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
              }`}
            >
              All
            </button>

            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory === category
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        {loading && <p className="text-gray-600">Loading menu...</p>}

        {error && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-100 p-4 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && filteredMenuItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">No menu items found</h3>
            <p className="mt-2 text-sm text-gray-500">
              Try another search term or choose a different category.
            </p>
          </div>
        )}

        {!loading && !error && filteredMenuItems.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredMenuItems.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </main>

      {isCartOpen && (
        <Cart
          cartItems={cartItems}
          onClose={() => setIsCartOpen(false)}
          onRemove={handleRemoveFromCart}
          onPlaceOrder={handlePlaceOrder}
          onApplyPromo={handleApplyPromo}
          customerName={customerName}
          setCustomerName={setCustomerName}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          specialInstructions={specialInstructions}
          setSpecialInstructions={setSpecialInstructions}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          paymentProofOption={paymentProofOption}
          setPaymentProofOption={setPaymentProofOption}
          paymentProofFile={paymentProofFile}
          setPaymentProofFile={setPaymentProofFile}
          discountAmount={discountAmount}
          subtotal={subtotal}
          isSubmitting={isSubmitting}
          isApplyingPromo={isApplyingPromo}
          promoMessage={promoMessage}
          promoError={promoError}
        />
      )}

      {orderConfirmation && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOrderConfirmation(null);
          }}
        >
          <div className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-bold text-green-700">Thank you! We have received your order.</h2>
              <button
                onClick={() => setOrderConfirmation(null)}
                className="rounded-full bg-gray-100 px-3 py-1 text-xl font-bold text-gray-700 hover:bg-gray-200"
                aria-label="Close confirmation"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-2 text-sm text-gray-600">Order ID: <span className="font-semibold text-gray-900">{orderConfirmation.orderId}</span></p>

              <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-semibold text-gray-800">Order Summary</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {(orderConfirmation.items || []).map((item, index) => (
                    <li key={index} className="flex items-center justify-between gap-3">
                      <span className="truncate">{item.name} x{item.quantity}</span>
                      <span className="font-semibold">₱{item.subtotal.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 border-t pt-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>₱{orderConfirmation.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-green-700">
                    <span>Discount</span>
                    <span>-₱{orderConfirmation.discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between font-bold text-gray-900">
                    <span>Total</span>
                    <span>₱{orderConfirmation.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                If you enjoyed our food, feel free to provide feedback on our page, and get a chance to win a promo code.
              </div>
            </div>

            <div className="border-t px-5 py-4">
              <button
                onClick={() => setOrderConfirmation(null)}
                className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FrontendPage;
