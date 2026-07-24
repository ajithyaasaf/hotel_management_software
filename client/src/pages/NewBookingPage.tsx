import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookingsApi, roomsApi, guestsApi, companiesApi } from '../api';
import type { Room } from '../types';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, UserCheck, AlertTriangle, Upload, FileText, X, Image as ImageIcon } from 'lucide-react';
import { getTodayIST, computeCalendarNightsIST } from '../utils/dateTime';
import SearchableSelect from '../components/ui/SearchableSelect';

interface BookingForm {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  idProofType: string;
  idProofNumber: string;
  idProofImage?: string;
  idProofBackImage?: string;
  isForeigner: boolean;
  passportNo: string;
  visaNo: string;
  visaExpiry: string;
  country: string;
  roomId: string;
  checkInDate: string;
  expectedCheckout: string;
  roomPrice: number | string;
  numberOfGuests: number | string;
  specialRequests: string;
  advanceAmount: number | string;
  advanceMethod: 'CASH' | 'UPI' | 'CARD' | 'BTC';
  companyId: string;
  billingRule: 'GUEST' | 'COMPANY_ROOM_ONLY' | 'COMPANY_ALL';
  accompanyingGuests: {
    name: string;
    idProofType: string;
    idProofNumber: string;
    idProofFrontImage?: string;
    idProofBackImage?: string;
    isForeigner: boolean;
    passportNo: string;
    visaNo: string;
    visaExpiry: string;
    country: string;
  }[];
}

export default function NewBookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselected = location.state as { roomId?: string; roomNumber?: string; roomPrice?: number } | null;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [guestFound, setGuestFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const [billingType, setBillingType] = useState<'INDIVIDUAL' | 'CORPORATE'>('INDIVIDUAL');
  const [existingIdProofUrl, setExistingIdProofUrl] = useState('');

  const [form, setForm] = useState<BookingForm>({
    guestName: '', guestPhone: '', guestEmail: '',
    idProofType: 'Aadhar', idProofNumber: '', idProofImage: '', idProofBackImage: '',
    isForeigner: false, passportNo: '', visaNo: '', visaExpiry: '', country: '',
    roomId: preselected?.roomId || '',
    checkInDate: getTodayIST(),
    expectedCheckout: '', roomPrice: preselected?.roomPrice || 0,
    numberOfGuests: 1, specialRequests: '',
    advanceAmount: 0, advanceMethod: 'CASH',
    companyId: '', billingRule: 'GUEST',
    accompanyingGuests: [],
  });

  useEffect(() => {
    companiesApi.getAll().then(res => setCompanies(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    roomsApi.getAvailable().then(r => {
      setRooms(r.data);
      if (!form.roomId && r.data.length > 0) {
        setForm(p => ({ ...p, roomId: r.data[0].id, roomPrice: Number(r.data[0].roomType.basePrice) }));
      }
    });
  }, []);

  // Auto-lookup guest when phone reaches 10 digits
  useEffect(() => {
    if (form.guestPhone.length === 10) {
      autoLookup(form.guestPhone);
    } else {
      setGuestFound(false);
    }
  }, [form.guestPhone]);

  async function autoLookup(phone: string) {
    setSearching(true);
    try {
      const { data } = await guestsApi.search(phone);
      if (data) {
        setForm(p => ({
          ...p, guestName: data.name,
          guestEmail: data.email || '', idProofType: data.idProofType || 'Aadhar',
          idProofNumber: data.idProofNumber || '',
          isForeigner: data.isForeigner || false,
          passportNo: data.passportNo || '',
          visaNo: data.visaNo || '',
          visaExpiry: data.visaExpiry ? data.visaExpiry.split('T')[0] : '',
          country: data.country || '',
        }));
        setGuestFound(true);
        setExistingIdProofUrl(data.idProofUrl || '');
        toast.success(`Welcome back, ${data.name}!`, { icon: '👋' });
      }
    } catch {
      // Fail silently for auto-lookup
    } finally {
      setSearching(false);
    }
  }

  function handleRoomChange(roomId: string) {
    const room = rooms.find(r => r.id === roomId);
    setForm(p => ({ ...p, roomId, roomPrice: room ? Number(room.roomType.basePrice) : 0 }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, field: 'idProofImage' | 'idProofBackImage', guestIndex?: number) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error('File size exceeds 8MB limit. Please choose a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new window.Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 1200;

        if (width > height && width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to 70% quality JPEG (turns 5MB into ~200KB)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

        if (guestIndex !== undefined) {
          setForm(p => {
            const newGuests = [...p.accompanyingGuests];
            if (field === 'idProofImage') newGuests[guestIndex].idProofFrontImage = compressedBase64;
            else newGuests[guestIndex].idProofBackImage = compressedBase64;
            return { ...p, accompanyingGuests: newGuests };
          });
        } else {
          setForm(p => ({ ...p, [field]: compressedBase64 }));
          if (field === 'idProofImage') setExistingIdProofUrl('');
        }
      };
    };
    reader.readAsDataURL(file);
  }

  function removeSelectedFile(field: 'idProofImage' | 'idProofBackImage', guestIndex?: number) {
    if (guestIndex !== undefined) {
      setForm(p => {
        const newGuests = [...p.accompanyingGuests];
        if (field === 'idProofImage') newGuests[guestIndex].idProofFrontImage = '';
        else newGuests[guestIndex].idProofBackImage = '';
        return { ...p, accompanyingGuests: newGuests };
      });
    } else {
      setForm(p => ({ ...p, [field]: '' }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.guestName || !form.guestPhone || !form.roomId || !form.expectedCheckout) {
      toast.error('Please fill all required fields'); return;
    }
    if (/^\d+$/.test(form.guestName)) {
      toast.error('Full Name cannot be just numbers'); return;
    }
    if (form.guestName.length < 3) {
      toast.error('Full Name must be at least 3 characters'); return;
    }
    if (form.guestPhone.length < 10) {
      toast.error('Phone number must be at least 10 digits'); return;
    }
    if (form.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guestEmail)) {
      toast.error('Please enter a valid email address'); return;
    }
    if (form.expectedCheckout < form.checkInDate) {
      toast.error('Checkout date cannot be before check-in date'); return;
    }
    setLoading(true);
    try {
      // Check-in timestamp: midnight IST of selected date.
      // The backend overwrites this with live `new Date()` for same-day (walk-in) bookings,
      // and stores it as the scheduled date for advance bookings.
      const checkInIso = new Date(`${form.checkInDate}T00:00:00+05:30`).toISOString();
      // Checkout timestamp: midnight IST of selected checkout date.
      // After the actual live check-in is stamped, the server computes expected checkout
      // as checkInDate + (checkout_date - checkin_date) full 24-hour cycles.
      const checkoutIso = new Date(`${form.expectedCheckout}T00:00:00+05:30`).toISOString();

      const payload = {
        ...form,
        roomPrice: Number(form.roomPrice) || 0,
        numberOfGuests: Number(form.numberOfGuests) || 1,
        advanceAmount: Number(form.advanceAmount) || 0,
        checkInDate: checkInIso,
        expectedCheckout: checkoutIso,
        guestEmail: form.guestEmail || null,
        companyId: form.companyId || null,
        billingRule: form.billingRule,
        guestName: form.guestName,
        idProofImage: form.idProofImage || null,
        idProofBackImage: form.idProofBackImage || null,
        isForeigner: form.isForeigner,
        passportNo: form.passportNo || null,
        visaNo: form.visaNo || null,
        visaExpiry: form.visaExpiry ? new Date(form.visaExpiry).toISOString() : null,
        country: form.country || null,
        accompanyingGuests: form.accompanyingGuests.slice(0, Number(form.numberOfGuests) - 1).map(ag => ({
          ...ag,
          idProofFrontImage: ag.idProofFrontImage || null,
          idProofBackImage: ag.idProofBackImage || null,
          passportNo: ag.passportNo || null,
          visaNo: ag.visaNo || null,
          visaExpiry: ag.visaExpiry ? new Date(ag.visaExpiry).toISOString() : null,
          country: ag.country || null,
        }))
      };
      const { data } = await bookingsApi.create(payload);
      toast.success(`Guest checked into Room ${data.room.roomNumber}!`);
      navigate(`/bookings/${data.id}`);
    } catch (err: any) {
      console.error('Booking creation error:', err);
      const serverErr = err.response?.data;
      toast.error(serverErr?.error || err.message || 'Booking failed');
    } finally { setLoading(false); }
  }

  const selectedCompany = companies.find(c => c.id === form.companyId);
  const checkIn = new Date(form.checkInDate);
  const checkOut = form.expectedCheckout ? new Date(form.expectedCheckout) : null;
  const nights = checkOut ? computeCalendarNightsIST(checkIn, checkOut) : 0;
  const estimatedCost = (Number(form.roomPrice) || 0) * nights;
  const creditLimitExceeded = selectedCompany 
    ? (Number(selectedCompany.outstandingBalance) + estimatedCost > Number(selectedCompany.creditLimit))
    : false;

  const numGuests = Number(form.numberOfGuests) || 1;
  const showAccompanyingGuests = numGuests > 1;

  // Sync accompanying guests array size with numberOfGuests
  useEffect(() => {
    if (numGuests > 1 && form.accompanyingGuests.length < numGuests - 1) {
      setForm(p => {
        const newGuests = [...p.accompanyingGuests];
        while (newGuests.length < numGuests - 1) {
          newGuests.push({ name: '', idProofType: 'Aadhar', idProofNumber: '', isForeigner: false, passportNo: '', visaNo: '', visaExpiry: '', country: '' });
        }
        return { ...p, accompanyingGuests: newGuests };
      });
    }
  }, [numGuests]);

  return (
    <div className="animate-fadeIn max-w-3xl">
      <button onClick={() => navigate(-1)} className="btn btn-ghost mb-4"><ArrowLeft size={18} /> Back</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">New Check-in</h1>
      <p className="text-gray-500 text-sm mb-6">Register guest and assign room</p>

      <form onSubmit={handleSubmit}>
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Guest Details</h3>
            {guestFound && <span className="text-emerald-600 text-xs font-medium flex items-center gap-1"><UserCheck size={14} /> Returning Guest</span>}
            {searching && <div className="animate-spin h-3 w-3 border-2 border-primary-600 border-t-transparent rounded-full ml-2" />}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number *</label>
              <input 
                className="input" 
                placeholder="Enter 10-digit number..."
                value={form.guestPhone} 
                onChange={e => setForm(p => ({ ...p, guestPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Full Name *</label>
              <input 
                className="input" 
                placeholder="Guest's full name"
                value={form.guestName} 
                onChange={e => {
                  setForm(p => ({ ...p, guestName: e.target.value }));
                  if (guestFound) setGuestFound(false);
                }} 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
              <input className="input" type="email" placeholder="email@example.com" value={form.guestEmail} onChange={e => setForm(p => ({ ...p, guestEmail: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Number of Guests</label>
              <input className="input" type="number" min={1} value={form.numberOfGuests} onChange={e => setForm(p => ({ ...p, numberOfGuests: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ID Proof Type</label>
              <select className="input" value={form.idProofType} onChange={e => setForm(p => ({ ...p, idProofType: e.target.value }))}>
                <option>Aadhar</option><option>Passport</option><option>Driving License</option><option>Voter ID</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ID Proof Number</label>
              <input className="input" placeholder="Enter ID number..." value={form.idProofNumber} onChange={e => setForm(p => ({ ...p, idProofNumber: e.target.value }))} />
            </div>

            <div className="md:col-span-2 mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-600">ID Proof Document (Aadhar / PAN Scan)</label>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${!form.isForeigner ? 'text-gray-900' : 'text-gray-400'}`}>Domestic</span>
                  <button type="button" onClick={() => setForm(p => ({ ...p, isForeigner: !p.isForeigner }))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isForeigner ? 'bg-primary-600' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${form.isForeigner ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                  <span className={`text-xs font-medium ${form.isForeigner ? 'text-primary-600' : 'text-gray-400'}`}>Foreign National</span>
                </div>
              </div>

              {form.isForeigner && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-4 bg-primary-50/30 rounded-xl border border-primary-100">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                    <input className="input text-sm" placeholder="e.g. USA" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Passport Number</label>
                    <input className="input text-sm" placeholder="Passport No" value={form.passportNo} onChange={e => setForm(p => ({ ...p, passportNo: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Visa Expiry Date</label>
                    <input type="date" className="input text-sm" value={form.visaExpiry} onChange={e => setForm(p => ({ ...p, visaExpiry: e.target.value }))} />
                  </div>
                </div>
              )}
              
              {existingIdProofUrl ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100/50 rounded-lg text-emerald-600"><UserCheck size={20} /></div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Saved ID Found</p>
                      <p className="text-xs text-emerald-600">This returning guest already has an ID proof uploaded.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                    <a href={existingIdProofUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary-600 hover:text-primary-700 bg-white border border-gray-200 py-1.5 px-3 rounded-lg shadow-sm flex-1 sm:flex-none justify-center text-center">View Saved ID</a>
                    <button type="button" onClick={() => setExistingIdProofUrl('')} className="text-xs font-semibold text-red-600 hover:text-red-700 bg-white border border-gray-200 py-1.5 px-3 rounded-lg shadow-sm flex-1 sm:flex-none justify-center">Replace ID</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Front Upload */}
                  {form.idProofImage ? (
                    <div className="flex items-center justify-between p-3 bg-primary-50/50 border border-primary-100 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 border overflow-hidden flex items-center justify-center">
                          <img src={form.idProofImage} alt="Front ID Preview" className="w-full h-full object-cover" />
                        </div>
                        <div><p className="text-sm font-semibold text-primary-800">Front Side Selected</p></div>
                      </div>
                      <button type="button" onClick={() => removeSelectedFile('idProofImage')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-500"><X size={18} /></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 hover:border-primary-400 rounded-xl p-6 cursor-pointer bg-gray-50/50 hover:bg-primary-50/10 transition-all group">
                      <Upload size={24} className="text-gray-400 group-hover:text-primary-500 mb-2 transition-colors" />
                      <span className="text-sm font-medium text-gray-700">Upload Front Side</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'idProofImage')} className="hidden" />
                    </label>
                  )}
                  {/* Back Upload */}
                  {form.idProofBackImage ? (
                    <div className="flex items-center justify-between p-3 bg-primary-50/50 border border-primary-100 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 border overflow-hidden flex items-center justify-center">
                          <img src={form.idProofBackImage} alt="Back ID Preview" className="w-full h-full object-cover" />
                        </div>
                        <div><p className="text-sm font-semibold text-primary-800">Back Side Selected</p></div>
                      </div>
                      <button type="button" onClick={() => removeSelectedFile('idProofBackImage')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-500"><X size={18} /></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 hover:border-primary-400 rounded-xl p-6 cursor-pointer bg-gray-50/50 hover:bg-primary-50/10 transition-all group">
                      <Upload size={24} className="text-gray-400 group-hover:text-primary-500 mb-2 transition-colors" />
                      <span className="text-sm font-medium text-gray-700">Upload Back Side</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'idProofBackImage')} className="hidden" />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Accompanying Guests */}
        {showAccompanyingGuests && form.accompanyingGuests.length > 0 && (
          <div className="card p-5 mb-6 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center justify-between">
              <span>Accompanying Guests ({form.accompanyingGuests.length})</span>
            </h3>
            <div className="space-y-4">
              {form.accompanyingGuests.map((ag, i) => (
                <div key={i} className="p-4 bg-white border border-gray-200 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-800">Guest {i + 2}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${!ag.isForeigner ? 'text-gray-900' : 'text-gray-400'}`}>Domestic</span>
                      <button type="button" onClick={() => {
                        const newGuests = [...form.accompanyingGuests];
                        newGuests[i].isForeigner = !newGuests[i].isForeigner;
                        setForm(p => ({ ...p, accompanyingGuests: newGuests }));
                      }} className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${ag.isForeigner ? 'bg-primary-600' : 'bg-gray-200'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${ag.isForeigner ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <input className="input text-sm" placeholder="Full Name *" value={ag.name} onChange={e => {
                        const newGuests = [...form.accompanyingGuests];
                        newGuests[i].name = e.target.value;
                        setForm(p => ({ ...p, accompanyingGuests: newGuests }));
                      }} />
                    </div>
                    <div>
                      <select className="input text-sm" value={ag.idProofType} onChange={e => {
                        const newGuests = [...form.accompanyingGuests];
                        newGuests[i].idProofType = e.target.value;
                        setForm(p => ({ ...p, accompanyingGuests: newGuests }));
                      }}>
                        <option>Aadhar</option><option>Passport</option><option>Driving License</option><option>Voter ID</option>
                      </select>
                    </div>
                  </div>

                  {ag.isForeigner && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-primary-50/30 rounded-lg border border-primary-100">
                      <div><input className="input text-xs" placeholder="Country" value={ag.country} onChange={e => { const newGuests = [...form.accompanyingGuests]; newGuests[i].country = e.target.value; setForm(p => ({ ...p, accompanyingGuests: newGuests })); }} /></div>
                      <div><input className="input text-xs" placeholder="Passport No" value={ag.passportNo} onChange={e => { const newGuests = [...form.accompanyingGuests]; newGuests[i].passportNo = e.target.value; setForm(p => ({ ...p, accompanyingGuests: newGuests })); }} /></div>
                      <div><input type="date" className="input text-xs" value={ag.visaExpiry} onChange={e => { const newGuests = [...form.accompanyingGuests]; newGuests[i].visaExpiry = e.target.value; setForm(p => ({ ...p, accompanyingGuests: newGuests })); }} /></div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Front Upload */}
                    {ag.idProofFrontImage ? (
                      <div className="flex items-center justify-between p-2 bg-gray-50 border rounded-lg">
                        <span className="text-xs font-medium text-gray-700">Front Uploaded</span>
                        <button type="button" onClick={() => removeSelectedFile('idProofImage', i)} className="p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center p-2 border border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                        <span className="text-xs text-gray-600">Upload Front</span>
                        <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'idProofImage', i)} className="hidden" />
                      </label>
                    )}
                    {/* Back Upload */}
                    {ag.idProofBackImage ? (
                      <div className="flex items-center justify-between p-2 bg-gray-50 border rounded-lg">
                        <span className="text-xs font-medium text-gray-700">Back Uploaded</span>
                        <button type="button" onClick={() => removeSelectedFile('idProofBackImage', i)} className="p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center p-2 border border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                        <span className="text-xs text-gray-600">Upload Back</span>
                        <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'idProofBackImage', i)} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Room & Stay</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Room *</label>
              <SearchableSelect
                options={rooms.map(r => ({ id: r.id, label: `Room ${r.roomNumber}`, sublabel: `${r.roomType.name} (₹${Number(r.roomType.basePrice)})` }))}
                value={form.roomId}
                onChange={handleRoomChange}
                placeholder="Select room..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Rate / Night (₹) *</label>
              <input className="input" type="number" value={form.roomPrice} onChange={e => setForm(p => ({ ...p, roomPrice: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Check-in Date *</label>
              <input
                className="input"
                type="date"
                min={getTodayIST()}
                value={form.checkInDate}
                onChange={e => setForm(p => ({ ...p, checkInDate: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Expected Checkout *</label>
              <input className="input" type="date" min={form.checkInDate} value={form.expectedCheckout} onChange={e => setForm(p => ({ ...p, expectedCheckout: e.target.value }))} required />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">Special Requests</label>
            <textarea className="input" rows={2} value={form.specialRequests} onChange={e => setForm(p => ({ ...p, specialRequests: e.target.value }))} />
          </div>
        </div>

        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Billing Information</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billing Account Type</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setBillingType('INDIVIDUAL');
                    setForm(p => ({ ...p, companyId: '', billingRule: 'GUEST' }));
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    billingType === 'INDIVIDUAL'
                      ? 'border-primary-600 bg-primary-50/50 text-primary-700 font-bold shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Individual Guest
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBillingType('CORPORATE');
                    const firstCompId = companies[0]?.id || '';
                    setForm(p => ({ ...p, companyId: firstCompId, billingRule: 'COMPANY_ROOM_ONLY' }));
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    billingType === 'CORPORATE'
                      ? 'border-primary-600 bg-primary-50/50 text-primary-700 font-bold shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Corporate Account (BTC)
                </button>
              </div>
            </div>

            {billingType === 'CORPORATE' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-dashed border-gray-100 animate-fadeIn">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Company / Corporate Client</label>
                  <select 
                    className="input" 
                    value={form.companyId} 
                    onChange={e => setForm(p => ({ ...p, companyId: e.target.value }))}
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Billing Instruction</label>
                  <select 
                    className="input" 
                    value={form.billingRule} 
                    onChange={e => setForm(p => ({ ...p, billingRule: e.target.value as any }))}
                  >
                    <option value="COMPANY_ROOM_ONLY">Room Only to Company (Extras to Guest)</option>
                    <option value="COMPANY_ALL">All Charges to Company</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {billingType === 'CORPORATE' && creditLimitExceeded && selectedCompany && (
            <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl text-amber-700 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle className="shrink-0 mt-0.5" size={16} />
              <div>
                <p className="font-bold">Credit Limit Warning</p>
                <p className="font-normal text-amber-800 mt-1">
                  {selectedCompany.name} outstanding balance (₹{Number(selectedCompany.outstandingBalance).toLocaleString('en-IN')}) 
                  plus estimated stay cost (₹{estimatedCost.toLocaleString('en-IN')}) will exceed its credit limit of ₹{Number(selectedCompany.creditLimit).toLocaleString('en-IN')}.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Advance Payment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Advance Amount (₹)</label>
              <input className="input" type="number" min={0} value={form.advanceAmount} onChange={e => setForm(p => ({ ...p, advanceAmount: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Payment Method</label>
              <select className="input" value={form.advanceMethod} onChange={e => setForm(p => ({ ...p, advanceMethod: e.target.value as any }))}>
                <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="BTC">Bill to Company (BTC)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn btn-outline flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn btn-primary flex-1 btn-lg">
            {loading ? 'Processing...' : 'Check In Guest'}
          </button>
        </div>
      </form>
    </div>
  );
}
