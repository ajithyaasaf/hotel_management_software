import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { banquetsApi, guestsApi, nightAuditApi, menuApi } from '../api';
import type { BanquetHall } from '../types';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, UserCheck, AlertTriangle, Users, Wine, IndianRupee } from 'lucide-react';

const EVENT_TYPES = ['Wedding', 'Birthday Party', 'Corporate Meeting', 'Conference', 'Seminar', 'Reception', 'Anniversary', 'Other'];

interface BanquetForm {
  guestPhone: string;
  guestName: string;
  hallId: string;
  eventDate: string;
  slot: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CUSTOM';
  startTime: string;
  endTime: string;
  eventType: string;
  estimatedPax: number | string;
  hallRentalPrice: number | string;
  perHeadFoodPrice: number | string;
  extraCharges: number | string;
  notes: string;
  foodPreference: 'VEG' | 'NON_VEG' | 'BOTH' | 'NONE';
  advanceAmount: number | string;
  advanceMethod: 'CASH' | 'UPI' | 'CARD';
  advanceReference: string;
}

export default function NewBanquetPage() {
  const navigate = useNavigate();
  const [halls, setHalls] = useState<BanquetHall[]>([]);
  const [businessDate, setBusinessDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [guestFound, setGuestFound] = useState(false);
  const [availability, setAvailability] = useState<{ slot: string; available: boolean }[]>([]);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [cgstRate, setCgstRate] = useState(0.025);
  const [sgstRate, setSgstRate] = useState(0.025);

  const [form, setForm] = useState<BanquetForm>({
    guestPhone: '', guestName: '',
    hallId: '', eventDate: '',
    slot: 'MORNING', startTime: '', endTime: '',
    eventType: 'Wedding',
    estimatedPax: '', hallRentalPrice: '', perHeadFoodPrice: 0,
    extraCharges: 0, notes: '',
    foodPreference: 'NONE',
    advanceAmount: 0, advanceMethod: 'CASH', advanceReference: '',
  });

  useEffect(() => {
    banquetsApi.getHalls().then(res => {
      setHalls(res.data);
      if (res.data.length > 0) {
        const first = res.data[0];
        setForm(p => ({ ...p, hallId: first.id, hallRentalPrice: Number(first.baseRental) }));
      }
    }).catch(() => {});

    nightAuditApi.getStatus().then(res => {
      const bDate = res.data.businessDate || res.data.currentBusinessDate;
      if (bDate) {
        setBusinessDate(bDate);
        setForm(p => ({ ...p, eventDate: bDate }));
      }
    }).catch(() => {});

    menuApi.getTaxConfig().then(res => {
      const cgstConfig = res.data.find((t: any) => t.name === 'CGST');
      const sgstConfig = res.data.find((t: any) => t.name === 'SGST');
      if (cgstConfig) setCgstRate(Number(cgstConfig.rate) / 100);
      if (sgstConfig) setSgstRate(Number(sgstConfig.rate) / 100);
    }).catch(() => {});
  }, []);

  // Auto-lookup guest when phone reaches 10 digits
  useEffect(() => {
    if (form.guestPhone.length === 10) autoLookup(form.guestPhone);
    else setGuestFound(false);
  }, [form.guestPhone]);

  // Re-check availability when hall or date changes
  useEffect(() => {
    if (form.hallId && form.eventDate) checkAvailability();
  }, [form.hallId, form.eventDate]);

  // Update rental price when hall changes
  const selectedHall = halls.find(h => h.id === form.hallId);

  async function autoLookup(phone: string) {
    setSearching(true);
    try {
      const { data } = await guestsApi.search(phone);
      if (data?.name) {
        setForm(p => ({ ...p, guestName: data.name }));
        setGuestFound(true);
        toast.success(`Returning guest found: ${data.name}`);
      }
    } catch { /* guest not found — new guest */ }
    finally { setSearching(false); }
  }

  async function checkAvailability() {
    setCheckingAvail(true);
    try {
      const res = await banquetsApi.checkAvailability(form.hallId, form.eventDate);
      setAvailability(res.data.availability || []);
    } catch { setAvailability([]); }
    finally { setCheckingAvail(false); }
  }

  function setField<K extends keyof BanquetForm>(key: K, val: BanquetForm[K]) {
    setForm(p => ({ ...p, [key]: val }));
  }

  // Calculate billing totals on the fly
  const pax = Number(form.estimatedPax) || 0;
  const rental = Number(form.hallRentalPrice) || 0;
  const perHead = Number(form.perHeadFoodPrice) || 0;
  const extras = Number(form.extraCharges) || 0;
  const subtotal = rental + (perHead * pax) + extras;
  const cgst = subtotal * cgstRate;
  const sgst = subtotal * sgstRate;
  const total = subtotal + cgst + sgst;
  const pending = total - Number(form.advanceAmount || 0);

  // Capacity validation
  const overCapacity = selectedHall && pax > 0 && pax > selectedHall.maxCapacity;

  // Past date validation
  const isPastDate = form.eventDate && businessDate && form.eventDate < businessDate;

  // Custom slot hour validation (frontend preview)
  const customDurationHours = form.startTime && form.endTime
    ? (new Date(form.endTime).getTime() - new Date(form.startTime).getTime()) / (1000 * 60 * 60)
    : null;
  const customTooShort = form.slot === 'CUSTOM' && customDurationHours !== null && customDurationHours < 4;

  const foodPriceInvalid = form.foodPreference !== 'NONE' && (Number(form.perHeadFoodPrice) <= 0 || !form.perHeadFoodPrice);
  const foodPriceNoneInvalid = form.foodPreference === 'NONE' && Number(form.perHeadFoodPrice) !== 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPastDate) { toast.error("Event date cannot be in the past."); return; }
    if (customTooShort) { toast.error("Custom slot duration must be at least 4 hours."); return; }
    if (foodPriceInvalid) { toast.error("Please enter a valid Per-Head Food Price since catering is requested."); return; }
    if (foodPriceNoneInvalid) { toast.error("Per-Head Food Price must be 0 when 'No Catering' is selected."); return; }
    if (pax <= 0) { toast.error("Estimated Guest Count must be greater than 0."); return; }
    if (!form.guestName || !form.guestPhone || !form.hallId || !form.eventDate) {
      toast.error("Please fill all required fields (Guest Name, Phone, Hall, Date)."); return;
    }
    
    setLoading(true);
    try {
      const payload: any = {
        guestPhone: form.guestPhone,
        guestName: form.guestName,
        hallId: form.hallId,
        eventDate: new Date(form.eventDate).toISOString(),
        slot: form.slot,
        eventType: form.eventType,
        estimatedPax: Number(form.estimatedPax),
        hallRentalPrice: Number(form.hallRentalPrice),
        perHeadFoodPrice: Number(form.perHeadFoodPrice),
        extraCharges: Number(form.extraCharges),
        notes: form.notes || null,
        foodPreference: form.foodPreference,
        advanceAmount: Number(form.advanceAmount) || 0,
        advanceMethod: form.advanceMethod,
        advanceReference: form.advanceReference || null,
      };
      if (form.slot === 'CUSTOM') {
        payload.startTime = new Date(form.startTime).toISOString();
        payload.endTime = new Date(form.endTime).toISOString();
      }
      const res = await banquetsApi.createBooking(payload);
      toast.success(`Banquet booking ${res.data.bookingNumber} created!`);
      navigate(`/banquets/${res.data.id}`);
    } catch (err: any) {
      console.error('Banquet booking creation error:', err);
      const data = err.response?.data;
      if (data?.details && Array.isArray(data.details)) {
        // Display the specific Zod field error
        const firstError = data.details[0];
        toast.error(`Invalid ${firstError.path.join('.')}: ${firstError.message}`);
      } else {
        toast.error(data?.error || err.message || 'Failed to create banquet booking');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/banquets')} className="btn btn-ghost btn-sm gap-1">
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wine size={20} className="text-primary-600" /> New Event Booking
          </h1>
          <p className="text-sm text-gray-500">Register a new banquet hall reservation</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Guest Information */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Guest / Organiser Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number *</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  value={form.guestPhone}
                  onChange={e => setField('guestPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile"
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {searching ? <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" /> :
                    guestFound ? <UserCheck size={16} className="text-emerald-500" /> :
                    form.guestPhone.length > 0 ? <Search size={16} className="text-gray-400" /> : null}
                </div>
              </div>
              {guestFound && <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Returning guest found</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Full Name *</label>
              <input
                className="input"
                value={form.guestName}
                onChange={e => setField('guestName', e.target.value)}
                placeholder="Organiser / Guest name"
                required
              />
            </div>
          </div>
        </div>

        {/* Hall Selection */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Hall & Schedule</h3>

          {halls.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
              <AlertTriangle size={18} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">No banquet halls configured</p>
                <p className="text-xs text-amber-600">Ask an Admin to add halls in Settings.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Select Hall *</label>
                  <select
                    className="input"
                    value={form.hallId}
                    onChange={e => {
                      const hall = halls.find(h => h.id === e.target.value);
                      setForm(p => ({ ...p, hallId: e.target.value, hallRentalPrice: hall ? Number(hall.baseRental) : p.hallRentalPrice }));
                    }}
                    required
                  >
                    {halls.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name} (max {h.maxCapacity} guests)
                      </option>
                    ))}
                  </select>
                  {selectedHall && (
                    <p className="text-xs text-gray-400 mt-1">Capacity: {selectedHall.maxCapacity} guests</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Event Date *</label>
                  <input
                    className={`input ${isPastDate ? 'border-red-400 bg-red-50' : ''}`}
                    type="date"
                    min={businessDate}
                    value={form.eventDate}
                    onChange={e => setField('eventDate', e.target.value)}
                    required
                  />
                  {isPastDate && (
                    <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Event date cannot be in the past. Current business date is {businessDate}.
                    </p>
                  )}
                </div>
              </div>

              {/* Slot Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-600">Session Slot *</label>
                  {checkingAvail && <span className="text-xs text-gray-400 animate-pulse">Checking availability...</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['MORNING', 'AFTERNOON', 'EVENING', 'CUSTOM'] as const).map(slot => {
                    const avail = availability.find(a => a.slot === slot);
                    const isBlocked = avail ? !avail.available : false;
                    const isSelected = form.slot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBlocked}
                        onClick={() => setField('slot', slot)}
                        className={`p-3 rounded-xl border-2 text-left transition-all text-sm
                          ${isBlocked ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed' :
                            isSelected ? 'border-primary-500 bg-primary-50 text-primary-700' :
                            'border-gray-200 hover:border-primary-300 text-gray-700'}`}
                      >
                        <p className="font-bold text-xs">
                          {slot === 'MORNING' ? '🌅' : slot === 'AFTERNOON' ? '☀️' : slot === 'EVENING' ? '🌙' : '🕐'} {slot}
                        </p>
                        {isBlocked && <p className="text-[10px] text-red-400 font-semibold mt-0.5">Booked</p>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Hours */}
              {form.slot === 'CUSTOM' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-primary-50/40 rounded-xl border border-primary-100">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Start Time *</label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={form.startTime}
                      onChange={e => setField('startTime', e.target.value)}
                      required={form.slot === 'CUSTOM'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">End Time *</label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={form.endTime}
                      onChange={e => setField('endTime', e.target.value)}
                      required={form.slot === 'CUSTOM'}
                    />
                  </div>
                  {customDurationHours !== null && (
                    <div className={`col-span-2 p-3 rounded-lg text-sm flex items-center gap-2 ${customTooShort ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                      {customTooShort ? <AlertTriangle size={16} /> : null}
                      Duration: {customDurationHours.toFixed(1)} hours
                      {customTooShort && ' — Minimum 4 hours required for custom bookings.'}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Event Details */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Event Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Event Type *</label>
              <select className="input" value={form.eventType} onChange={e => setField('eventType', e.target.value)}>
                {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Estimated Guest Count *</label>
              <div className="relative">
                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={`input pl-9 ${overCapacity ? 'border-amber-400 bg-amber-50/30' : ''}`}
                  type="number"
                  min="1"
                  value={form.estimatedPax}
                  onChange={e => setField('estimatedPax', e.target.value)}
                  required
                />
              </div>
              {overCapacity && (
                <p className="text-xs text-amber-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Warning: Guest count exceeds maximum hall capacity ({selectedHall?.maxCapacity} guests)
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Food Preference *</label>
              <select
                className="input"
                value={form.foodPreference}
                onChange={e => {
                  const val = e.target.value as any;
                  setForm(p => ({
                    ...p,
                    foodPreference: val,
                    perHeadFoodPrice: val === 'NONE' ? 0 : p.perHeadFoodPrice || '',
                  }));
                }}
              >
                <option value="NONE">None (No Catering)</option>
                <option value="VEG">Pure Vegetarian</option>
                <option value="NON_VEG">Non-Vegetarian</option>
                <option value="BOTH">Veg & Non-Veg (Both)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Notes / Special Requests</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Decorations, seating arrangement, dietary requirements..." />
          </div>
        </div>

        {/* Pricing */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Pricing & Billing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Hall Rental (₹) *</label>
              <input className="input" type="number" min="0" value={form.hallRentalPrice} onChange={e => setField('hallRentalPrice', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Per-Head Food Price (₹) {form.foodPreference !== 'NONE' && '*'}
              </label>
              <input
                className="input disabled:bg-gray-100 disabled:text-gray-400"
                type="number"
                min={form.foodPreference !== 'NONE' ? "1" : "0"}
                value={form.perHeadFoodPrice}
                onChange={e => setField('perHeadFoodPrice', e.target.value)}
                disabled={form.foodPreference === 'NONE'}
                required={form.foodPreference !== 'NONE'}
                placeholder={form.foodPreference === 'NONE' ? "No Catering" : "Enter Price"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Extra Charges (₹)</label>
              <input className="input" type="number" min="0" value={form.extraCharges} onChange={e => setField('extraCharges', e.target.value)} />
            </div>
          </div>

          {/* Bill Preview */}
          {subtotal > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Hall Rental</span><span>₹{rental.toLocaleString()}</span>
              </div>
              {perHead > 0 && pax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Food (₹{perHead}/head × {pax} guests)</span><span>₹{(perHead * pax).toLocaleString()}</span>
                </div>
              )}
              {extras > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Extra Charges</span><span>₹{extras.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500 border-t pt-2">
                <span>CGST ({(cgstRate * 100).toFixed(1)}%)</span><span>₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>SGST ({(sgstRate * 100).toFixed(1)}%)</span><span>₹{sgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t pt-2 text-base">
                <span>Total Invoice</span><span>₹{total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Advance Deposit */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <IndianRupee size={14} className="text-primary-600" /> Advance Deposit (Optional)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount (₹)</label>
                <input className="input" type="number" min="0" value={form.advanceAmount} onChange={e => setField('advanceAmount', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Payment Method</label>
                <select className="input" value={form.advanceMethod} onChange={e => setField('advanceMethod', e.target.value as any)}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Reference No</label>
                <input className="input" value={form.advanceReference} onChange={e => setField('advanceReference', e.target.value)} placeholder="UPI Ref / Cheque No" />
              </div>
            </div>
            {Number(form.advanceAmount) > 0 && total > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Remaining balance after deposit: <span className="font-bold text-gray-800">₹{pending.toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="button" className="btn btn-outline flex-1" onClick={() => navigate('/banquets')}>Cancel</button>
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={loading}
          >
            {loading ? 'Creating Booking...' : 'Create Event Booking'}
          </button>
        </div>
      </form>
    </div>
  );
}
