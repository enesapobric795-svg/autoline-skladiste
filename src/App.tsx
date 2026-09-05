import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface Part {
  id: string;
  naziv: string;
  'marka vozila': string;
  'kataloški broj': string;
  podkataloski_broj: string;
  interna_sifra?: string | number | null;
  'interna sifra'?: string | number | null;
  količina?: number;
  kolicina?: number;
  cijena: number;
  lokacija: string;
  slika: string;
  napomena: string;
}

export default function App() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [selectedBrand, setSelectedBrand] = useState('');

  const [naziv, setNaziv] = useState('');
  const [markaVozila, setMarkaVozila] = useState('');
  const [kataloskiBroj, setKataloskiBroj] = useState('');
  const [internaSifra, setInternaSifra] = useState('');
  const [podkataloskiBroj, setPodkataloskiBroj] = useState('');
  const [kolicina, setKolicina] = useState<number | ''>(0);
  const [cijena, setCijena] = useState<number | ''>(0);
  const [lokacija, setLokacija] = useState('');
  const [napomena, setNapomena] = useState('');

  const [slikaFile, setSlikaFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);

  const [olxUsername, setOlxUsername] = useState('');
  const [olxPassword, setOlxPassword] = useState('');
  const [olxToken, setOlxToken] = useState<string | null>(null);
  const [importingOlx, setImportingOlx] = useState(false);

  const [modalPart, setModalPart] = useState<Part | null>(null);
  const [olxTitle, setOlxTitle] = useState('');
  const [olxBrand, setOlxBrand] = useState('');
  const [olxCatNumber, setOlxCatNumber] = useState('');
  const [olxListingId, setOlxListingId] = useState('');
  const [olxCategoryId, setOlxCategoryId] = useState('');
  const [olxListingType, setOlxListingType] = useState('sell');
  const [olxImage, setOlxImage] = useState<string | null>(null);
  const [publishingToOlx, setPublishingToOlx] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchParts();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchParts();
      } else {
        setParts([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchParts() {
    setLoading(true);
    setLoadError('');
    try {
      const allParts: Part[] = [];
      const pageSize = 1000;

      for (let from = 0; from < 50000; from += pageSize) {
        const { data, error } = await supabase
          .from('dijelovi')
          .select('*')
          .range(from, from + pageSize - 1);

        if (error) throw error;

        allParts.push(...((data || []) as unknown as Part[]));
        if (!data || data.length < pageSize) break;
      }

      setParts(allParts);
    } catch (err) {
      console.error(err);
      setParts([]);
      setLoadError('Podaci iz baze nisu mogli biti učitani. Provjerite internet i Supabase pravila pristupa.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    const fullEmail = email.includes('@') ? email : `${email}@auto.com`;

    const { error } = await supabase.auth.signInWithPassword({
      email: fullEmail,
      password,
    });

    if (error) alert('Greška pri prijavi: Pogrešno korisničko ime ili lozinka');
    setAuthLoading(false);
  }

  async function handleLogout() {
    setOlxToken(null);
    await supabase.auth.signOut();
  }

  function getInternalCode(part: Part) {
    return String(
      part.interna_sifra ??
      part['interna sifra'] ??
      ''
    ).trim();
  }

  function searchable(value: unknown) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('bs-BA')
      .trim();
  }

  async function uploadImage(file: File): Promise<string | null> {
    try {
      setUploadingImage(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('slike-dijelova')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('slike-dijelova')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error: any) {
      alert('Greška pri uploadu slike: ' + error.message);
      return null;
    } finally {
      setUploadingImage(false);
    }
  }

  async function postToOlxApi(oglasData: { title: string; price: number; description: string; image: string | null; category_id: string; listing_type: string }) {
    function formatApiError(errorData: any, fallback: string) {
      if (typeof errorData === 'string' && errorData.trim()) return errorData;
      if (errorData?.message) {
        return typeof errorData.message === 'string'
          ? errorData.message
          : JSON.stringify(errorData.message);
      }
      if (errorData?.error) {
        return typeof errorData.error === 'string'
          ? errorData.error
          : JSON.stringify(errorData.error);
      }
      if (errorData && Object.keys(errorData).length > 0) {
        return JSON.stringify(errorData);
      }
      return fallback;
    }

    const clientId = import.meta.env.VITE_OLX_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_OLX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Nedostaju VITE_OLX_CLIENT_ID ili VITE_OLX_CLIENT_SECRET u .env fajlu.');
    }

    if (!olxUsername || !olxPassword) {
      throw new Error('Morate unijeti OLX korisničko ime i lozinku gore u formu za uvoz/podešavanja.');
    }

    let token = olxToken;
    if (!token) {
      const authRes = await fetch('/olx-api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'OLX-CLIENT-ID': clientId,
          'OLX-CLIENT-TOKEN': clientSecret
        },
        body: JSON.stringify({
          username: olxUsername,
          password: olxPassword,
          device_name: 'skladiste_app'
        })
      });

      const authData = await authRes.json().catch(() => ({}));
      if (!authRes.ok) {
        throw new Error(formatApiError(authData, `OLX prijava nije uspjela (HTTP ${authRes.status}).`));
      }

      token = authData.token;
      setOlxToken(token);
    }

    const response = await fetch('/olx-api/listings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: oglasData.title,
        price: oglasData.price,
        category_id: Number(oglasData.category_id),
        listing_type: oglasData.listing_type,
        description: oglasData.description,
        image: oglasData.image
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errRes = result;
      throw new Error(formatApiError(errRes, `Greška prilikom objavljivanja na OLX API (HTTP ${response.status}).`));
    }

    const listing = result?.data || result;
    const listingId = listing?.id || listing?.listing_id;
    if (!listingId) {
      throw new Error(`OLX nije vratio ID kreiranog oglasa. Odgovor API-ja: ${JSON.stringify(result)}`);
    }

    const profileResponse = await fetch(
      `/olx-api/users/${encodeURIComponent(olxUsername)}/listings?q=${encodeURIComponent(oglasData.title)}&page=1`
    );
    const profileResult = await profileResponse.json().catch(() => ({}));
    const profileListings = Array.isArray(profileResult?.data) ? profileResult.data : [];
    const appearsOnProfile = profileListings.some((item: any) => String(item.id) === String(listingId));
    return {
      id: String(listingId),
      appearsOnProfile,
      status: listing?.status || 'pending',
      visible: listing?.visible ?? false
    };
  }

  function openOlxModal(part: Part) {
    setModalPart(part);
    setOlxTitle(part.naziv || '');
    setOlxBrand(part['marka vozila'] || '');
    setOlxCatNumber(part['kataloški broj'] || '');
    setOlxListingId(part.id || '');
    setOlxCategoryId('936');
    setOlxListingType('sell');
    setOlxImage(part.slika || null);
  }

  async function handleConfirmOlxPublish() {
    if (!olxTitle) return alert('Naslov oglasa je obavezan!');
    if (!olxListingId.trim()) return alert('ID oglasa je obavezan!');
    if (!olxCategoryId.trim() || !/^\d+$/.test(olxCategoryId.trim())) {
      return alert('Kategorija oglasa je obavezna i mora biti broj (category ID).');
    }
    if (!olxListingType) return alert('Vrsta oglasa je obavezna.');

    const categoryResponse = await fetch(`/olx-api/categories/${olxCategoryId.trim()}`);
    const categoryResult = await categoryResponse.json().catch(() => ({}));
    if (!categoryResponse.ok) {
      return alert(`Kategorija nije pronađena (HTTP ${categoryResponse.status}).`);
    }
    const category = categoryResult.data;
    if (Array.isArray(category) || category?.sub_categories?.length > 0) {
      return alert('Ovaj ID nije krajnja OLX kategorija. Unesite ID podkategorije bez dodatnih podkategorija.');
    }
    
    const finalDescription = 
      `Naziv: ${olxTitle}\n` +
      `Marka vozila: ${olxBrand || 'Univerzalno'}\n` +
      `Kataloški broj: ${olxCatNumber || '---'}`;

    setPublishingToOlx(true);
    try {
      const createdListing = await postToOlxApi({
        title: olxTitle,
        price: 0,
        category_id: olxCategoryId.trim(),
        listing_type: olxListingType,
        description: finalDescription,
        image: olxImage
      });
      const visibilityMessage = createdListing.appearsOnProfile
        ? 'Oglas je vidljiv na profilu.'
        : 'OLX ga je prihvatio, ali još nije vidljiv na javnom profilu. Provjerite status u OLX nalogu.';
      alert(`Artikal "${olxTitle}" je prihvaćen.\nID oglasa: ${createdListing.id}\nStatus: ${createdListing.status}\n${visibilityMessage}\n\nLink: https://olx.ba/artikal/${createdListing.id}`);
      setModalPart(null);
    } catch (err: any) {
      alert('Greška pri objavi: ' + err.message);
    } finally {
      setPublishingToOlx(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!naziv) return alert('Naziv je obavezan!');

    let currentSlikaUrl = null;
    if (editingPartId) {
      const partBeingEdited = parts.find((p) => p.id === editingPartId);
      if (partBeingEdited) currentSlikaUrl = partBeingEdited.slika;
    }

    if (slikaFile) {
      const uploadedUrl = await uploadImage(slikaFile);
      if (uploadedUrl) currentSlikaUrl = uploadedUrl;
    }

    const partData: any = {
      naziv: naziv.trim(),
      'marka vozila': markaVozila.trim() || null,
      'kataloški broj': kataloskiBroj.trim() || null,
      podkataloski_broj: podkataloskiBroj.trim() || null,
      interna_sifra: internaSifra.trim() || null,
      količina: Number(kolicina || 0),
      cijena: Number(cijena || 0),
      lokacija: lokacija.trim() || null,
      slika: currentSlikaUrl,
      napomena: napomena.trim() || null,
    };

    if (editingPartId) {
      const { error } = await supabase.from('dijelovi').update(partData).eq('id', editingPartId);
      if (error) alert('Greška: ' + error.message);
      else {
        alert('Ažurirano u bazi!');
        cancelEdit(); 
        fetchParts(); 
      }
    } else {
      const { error } = await supabase.from('dijelovi').insert([partData]);
      if (error) alert('Greška: ' + error.message);
      else {
        alert('Dodano u skladište!');
        cancelEdit(); 
        fetchParts(); 
      }
    }
  }

  function startEdit(part: Part) {
    setEditingPartId(part.id);
    setNaziv(part.naziv || '');
    setMarkaVozila(part['marka vozila'] || '');
    setKataloskiBroj(part['kataloški broj'] || '');
    setInternaSifra(getInternalCode(part));
    setPodkataloskiBroj(part.podkataloski_broj || '');
    setKolicina(part.količina ?? part.kolicina ?? 0);
    setCijena(part.cijena || 0);
    setLokacija(part.lokacija || '');
    setNapomena(part.napomena || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingPartId(null);
    setNaziv(''); setMarkaVozila(''); setKataloskiBroj(''); setInternaSifra('');
    setPodkataloskiBroj(''); setKolicina(0); setCijena(0); setLokacija(''); setNapomena('');
    setSlikaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function deletePart(id: string) {
    if (confirm('Jeste li sigurni da želite obrisati ovaj dio?')) {
      await supabase.from('dijelovi').delete().eq('id', id);
      if (editingPartId === id) cancelEdit();
      fetchParts();
    }
  }

  async function handleOlxImport() {
    if (!olxUsername || !olxPassword) {
      return alert('Molimo unesite OLX korisničko ime i lozinku za prijavu!');
    }

    const clientId = import.meta.env.VITE_OLX_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_OLX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return alert('Nedostaju VITE_OLX_CLIENT_ID ili VITE_OLX_CLIENT_SECRET u .env fajlu!');
    }

    setImportingOlx(true);
    try {
      const authRes = await fetch('/olx-api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'OLX-CLIENT-ID': clientId,
          'OLX-CLIENT-TOKEN': clientSecret
        },
        body: JSON.stringify({
          username: olxUsername,
          password: olxPassword,
          device_name: 'skladiste_app'
        })
      });

      const authData = await authRes.json().catch(() => ({}));
      if (!authRes.ok) {
        throw new Error(authData.message || authData.error || `OLX prijava nije uspjela (HTTP ${authRes.status}).`);
      }

      const token = authData.token;
      let page = 1;
      let noviUpisani = 0;
      let preskoceni = 0;
      let hasMore = true;

      while (hasMore) {
        const listRes = await fetch(`/olx-api/listings?page=${page}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        const listData = await listRes.json();
        if (!listRes.ok) throw new Error('Neuspješno preuzimanje oglasa sa OLX-a.');

        const oglasi = listData.data || listData || [];
        if (oglasi.length === 0) {
          hasMore = false;
          break;
        }

        for (const oglas of oglasi) {
          const nazivOglasa = (oglas.title || 'Uvezeni artikal').trim();
          const postoji = parts.some(
            (p) => p.naziv && p.naziv.trim().toLowerCase() === nazivOglasa.toLowerCase()
          );

          if (postoji) {
            preskoceni++;
            continue;
          }

          const novi = {
            naziv: nazivOglasa,
            cijena: Number(oglas.price || 0),
            količina: 1,
            napomena: 'Uvezeno sa OLX-a'
          };

          const { error } = await supabase.from('dijelovi').insert([novi]);
          if (!error) noviUpisani++;
        }

        page++;
        if (page > 600) break;
      }

      alert(`Uvoz gotov! Dodano novih artikala: ${noviUpisani}, Preskočeno (već postoje): ${preskoceni}`);
      fetchParts();
    } catch (err: any) {
      alert('Greška pri uvozu: ' + err.message);
    } finally {
      setImportingOlx(false);
    }
  }

  const ukupnoNaStanju = parts.reduce((sum, p) => {
    const kol = Number(p.količina ?? p.kolicina ?? 0);
    return sum + (isNaN(kol) ? 0 : kol);
  }, 0);

  const uniqueBrands = Array.from(
    new Set(parts.map((p) => p['marka vozila']?.trim()).filter(Boolean))
  ).sort();

  const filteredParts = parts.filter((p) => {
    const query = searchable(search);
    const code = searchable(getInternalCode(p));
    const matchSearch =
      searchable(p.naziv).includes(query) ||
      searchable(p['kataloški broj']).includes(query) ||
      code.includes(query) ||
      searchable(p['marka vozila']).includes(query);

    const matchBrand = selectedBrand === '' || p['marka vozila'] === selectedBrand;
    return matchSearch && matchBrand;
  });

  const baseInputStyle = {
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    backgroundColor: '#f8fafc',
    outline: 'none',
    transition: 'all 0.2s ease',
    width: '100%',
    boxSizing: 'border-box' as const
  };

  if (!session) {
    return (
      <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '400px', borderTop: '5px solid #2563eb' }}>
          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <h2 style={{ color: '#0f172a', margin: '0 0 8px 0', fontSize: '24px' }}>Auto Line d.o.o.</h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Prijavite se u sistem skladišta</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Korisničko ime / Email</label>
              <input type="text" placeholder="Unesite email" value={email} onChange={(e) => setEmail(e.target.value)} required style={baseInputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Lozinka</label>
              <input type="password" placeholder="Unesite lozinku" value={password} onChange={(e) => setPassword(e.target.value)} required style={baseInputStyle} />
            </div>
            <button type="submit" disabled={authLoading} style={{ marginTop: '10px', padding: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)' }}>
              {authLoading ? 'Prijava u toku...' : 'Prijavi se'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#1e293b', paddingBottom: '60px' }}>
      
      {/* GLAVNO ZAGLAVLJE */}
      <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '10px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '18px' }}>AL</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>Auto Line d.o.o.</h1>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Sistem za upravljanje skladištem dijelova</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ backgroundColor: '#f1f5f9', padding: '8px 16px', borderRadius: '10px', fontSize: '14px', border: '1px solid #e2e8f0' }}>
            Ukupno komada: <strong style={{ color: '#2563eb', fontSize: '16px' }}>{ukupnoNaStanju}</strong>
          </div>
          <button onClick={handleLogout} style={{ padding: '9px 16px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' }}>Odjavi se</button>
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* OLX SEKCIJA */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📥</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>OLX.ba (PIK) API sinhronizacija</h3>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Unesite vaše OLX podatke za automatsko objavljivanje i pametni uvoz artikala (bez duplikata):</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="OLX Korisničko ime" value={olxUsername} onChange={(e) => setOlxUsername(e.target.value)} style={{ ...baseInputStyle, flex: 1, minWidth: '220px' }} />
            <input type="password" placeholder="OLX Lozinka" value={olxPassword} onChange={(e) => setOlxPassword(e.target.value)} style={{ ...baseInputStyle, flex: 1, minWidth: '220px' }} />
            <button onClick={handleOlxImport} disabled={importingOlx} style={{ padding: '11px 22px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)' }}>
              {importingOlx ? 'Uvoz u toku...' : 'Pokreni pametni uvoz'}
            </button>
          </div>
        </div>

        {/* FORMA ZA UNOS/UREĐENJE */}
        <div style={{ backgroundColor: '#ffffff', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '17px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {editingPartId ? '✏️ Uredi postojeći artikal' : '➕ Dodaj novi artikal u skladište'}
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Naziv dijela *</label>
                <input type="text" placeholder="npr. Prednji branik" value={naziv} onChange={(e) => setNaziv(e.target.value)} style={baseInputStyle} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Marka vozila</label>
                <input type="text" placeholder="npr. Volkswagen" value={markaVozila} onChange={(e) => setMarkaVozila(e.target.value)} style={baseInputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Kataloški broj</label>
                <input type="text" placeholder="npr. 1K0807217" value={kataloskiBroj} onChange={(e) => setKataloskiBroj(e.target.value)} style={baseInputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Interna šifra</label>
                <input type="text" placeholder="Interna oznaka" value={internaSifra} onChange={(e) => setInternaSifra(e.target.value)} style={baseInputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Lokacija</label>
                <input type="text" placeholder="npr. Police A-3" value={lokacija} onChange={(e) => setLokacija(e.target.value)} style={baseInputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Količina</label>
                <input type="number" placeholder="0" value={kolicina} onChange={(e) => setKolicina(e.target.value === '' ? '' : Number(e.target.value))} style={baseInputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Cijena (KM)</label>
                <input type="number" step="0.01" placeholder="0.00" value={cijena} onChange={(e) => setCijena(e.target.value === '' ? '' : Number(e.target.value))} style={baseInputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Slika artikla</label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => { if (e.target.files) setSlikaFile(e.target.files[0]); }} style={{ ...baseInputStyle, padding: '7px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button type="submit" disabled={uploadingImage} style={{ padding: '12px 28px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
                {uploadingImage ? 'Slanje slike...' : editingPartId ? 'Sačuvaj izmjene' : 'Dodaj u skladište'}
              </button>
              {editingPartId && (
                <button type="button" onClick={cancelEdit} style={{ padding: '12px 20px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Otkaži</button>
              )}
            </div>
          </form>
        </div>

        {/* PRETRAGA I FILTERI */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="🔍 Pretraži po nazivu, kat. broju, šifri..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...baseInputStyle, flex: 2, minWidth: '280px', backgroundColor: '#ffffff' }} />
          <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} style={{ ...baseInputStyle, flex: 1, minWidth: '200px', fontWeight: '600', color: '#0f172a', backgroundColor: '#ffffff' }}>
            <option value="">Sve marke vozila</option>
            {uniqueBrands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* KARTICE ARTIKALA */}
        {loadError ? (
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#fef2f2', borderRadius: '16px', border: '1px solid #fecaca', color: '#b91c1c' }}>
            {loadError}
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Učitavanje artikala...</div>
        ) : filteredParts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#64748b' }}>Nema pronađenih artikala.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {filteredParts.map((part) => {
              const code = getInternalCode(part);
              const kolVal = part.količina ?? part.kolicina ?? 0;
              return (
                <div key={part.id} style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                  <div style={{ height: '170px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                    {part.slika ? (
                      <img src={part.slika} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '500' }}>NEMA SLIKE</span>
                    )}
                    <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backdropFilter: 'blur(4px)' }}>
                      Kol: {kolVal}
                    </div>
                  </div>

                  <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{part.naziv}</h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      <span>Marka: <strong style={{ color: '#334155' }}>{part['marka vozila'] || 'Univerzalno'}</strong></span>
                      <span>Kat. broj: <code style={{ color: '#0f172a', backgroundColor: '#f1f5f9', padding: '2px 5px', borderRadius: '4px' }}>{part['kataloški broj'] || '---'}</code></span>
                      {code && <span>Interna šifra: <strong style={{ color: '#2563eb' }}>{code}</strong></span>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Cijena:</span>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#2563eb' }}>{Number(part.cijena || 0).toFixed(2)} KM</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                      <button onClick={() => startEdit(part)} style={{ padding: '8px', backgroundColor: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Uredi</button>
                      <button onClick={() => deletePart(part.id)} style={{ padding: '8px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Obriši</button>
                    </div>

                    <button onClick={() => openOlxModal(part)} style={{ padding: '9px', backgroundColor: '#ffedd5', color: '#c2410c', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <span>📢</span> Objavi na OLX
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* MODALNI PROZOR */}
      {modalPart && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: '700' }}>Konfiguracija OLX oglasa</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Provjerite i uredite podatke prije slanja na OLX API (osjetljivi podaci poput cijene i lokacije se ne šalju):</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Naslov oglasa:</label>
              <input type="text" value={olxTitle} onChange={(e) => setOlxTitle(e.target.value)} style={baseInputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Marka vozila:</label>
              <input type="text" value={olxBrand} onChange={(e) => setOlxBrand(e.target.value)} style={baseInputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Kataloški broj:</label>
              <input type="text" value={olxCatNumber} onChange={(e) => setOlxCatNumber(e.target.value)} style={baseInputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>ID oglasa:</label>
              <input type="text" value={olxListingId} onChange={(e) => setOlxListingId(e.target.value)} style={baseInputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Vrsta oglasa:</label>
              <select value={olxListingType} onChange={(e) => setOlxListingType(e.target.value)} style={baseInputStyle}>
                <option value="sell">Prodaja</option>
                <option value="buy">Potražnja</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Kategorija oglasa (ID):</label>
              <input type="number" min="1" placeholder="Npr. 123" value={olxCategoryId} onChange={(e) => setOlxCategoryId(e.target.value)} style={baseInputStyle} />
            </div>

            {olxImage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <img src={olxImage} alt="" style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '8px' }} />
                <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>Slika je spremna za objavu.</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={handleConfirmOlxPublish} disabled={publishingToOlx} style={{ flex: 1, padding: '12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)' }}>
                {publishingToOlx ? 'Slanje...' : 'Potvrdi i objavi'}
              </button>
              <button onClick={() => setModalPart(null)} style={{ padding: '12px 20px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                Otkaži
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}