'use strict';
const $ = (id) => document.getElementById(id);
let participants = [], draw = null, loading = false, drawing = false;
let token = '';
try { token = sessionStorage.getItem('alze-admin-session') || ''; } catch {}
const config = window.ALZE_CONFIG || {};
let configured = false;
try { const api = new URL(config.apiUrl); configured = api.protocol === 'https:' && !api.username && !api.password && !api.search && !api.hash && (api.pathname === '/' || api.pathname === ''); } catch {}
function message(id, text = '', type = '') { $(id).textContent = text; $(id).className = `message ${type}`; }
function saveToken(value) { token = value; try { value ? sessionStorage.setItem('alze-admin-session', value) : sessionStorage.removeItem('alze-admin-session'); } catch {} }
async function rpc(name, args = {}) {
  if (!configured) throw new Error('Kayıt bağlantısı henüz kurulmadı. Lütfen daha sonra tekrar deneyin.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const headers = { 'Content-Type': 'application/json' };
    const response = await fetch(`${config.apiUrl.replace(/\/$/, '')}/api/${name}`, { method: 'POST', headers, body: JSON.stringify(args), signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    const body = await response.json();
    if (!response.ok) {
      if (body.message === 'SESSION_EXPIRED') { logout(); throw new Error('Oturumun sona erdi. Yeniden giriş yap.'); }
      const known = { DRAW_CLOSED: 'Çekiliş tamamlandı. Yeni katılım alınmıyor.', INVALID_NAME: 'Lütfen geçerli bir ad ve soyad yazın.', NOT_ENOUGH: 'Çekiliş için en az 2 katılımcı gerekiyor.', BUSY: 'Şu anda yoğunluk var. Lütfen biraz bekleyip tekrar dene.', CAPACITY: 'Bu çekiliş için kayıt kapasitesine ulaşıldı.', NOT_CONFIGURED: 'Kayıt bağlantısı henüz kurulmadı.', PRIVATE_REPO_REQUIRED: 'Kayıt deposunun gizlilik ayarı tamamlanmamış. Lütfen yöneticiye bildir.', STORAGE_CONFIG: 'Kayıt bağlantısının ayarları kontrol edilmeli. Lütfen yöneticiye bildir.', STORAGE_UNAVAILABLE: 'Kayıt hizmetine ulaşılamıyor. Lütfen biraz sonra tekrar dene.', STORAGE_DATA: 'Kayıt dosyası kontrol edilmeli. Lütfen yöneticiye bildir.', FORBIDDEN: 'Bu site adresi için bağlantı izni tanımlanmamış.' };
      throw new Error(known[body.message] || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.');
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('İşlemin sonucu doğrulanamadı. Bağlantını kontrol et; kaydı tekrar gönderebilir veya yönetici ekranını yenileyebilirsin.');
    throw error;
  } finally { clearTimeout(timeout); }
}
function showAdmin() { $('public-view').hidden = true; $('admin-view').hidden = false; if (token) refresh().catch(e => message('admin-message', e.message, 'error')); }
function logout() { saveToken(''); participants = []; draw = null; $('participant-list').replaceChildren(); $('results').hidden = true; $('participant-count').textContent = '0'; $('dashboard').hidden = true; $('login-panel').hidden = false; $('password').value = ''; }
function date(value) { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(value)); }
function renderList() {
  const query = $('search').value.trim().toLocaleLowerCase('tr');
  const filtered = participants.filter(p => p.full_name.toLocaleLowerCase('tr').includes(query));
  $('participant-list').replaceChildren();
  const fragment = document.createDocumentFragment();
  filtered.forEach((p, i) => {
    const li = document.createElement('li'), number = document.createElement('span'), person = document.createElement('div'), name = document.createElement('strong'), time = document.createElement('small');
    number.className = 'number'; number.textContent = String(i + 1).padStart(2, '0'); person.className = 'person'; name.textContent = p.full_name; time.textContent = date(p.created_at); person.append(name, time); li.append(number, person); fragment.append(li);
  });
  $('participant-list').append(fragment);
  $('list-status').textContent = participants.length ? `${filtered.length} katılımcı gösteriliyor` : 'Henüz katılımcı yok. İlk kayıt burada görünecek.';
}
function renderDraw() {
  $('draw-button').disabled = drawing || Boolean(draw) || participants.length < 2;
  $('draw-button').textContent = draw ? 'Çekiliş tamamlandı ✓' : drawing ? 'Şanslı isimler seçiliyor…' : 'Çekilişi yap ✦';
  $('results').hidden = !draw;
  if (draw) { $('winner-name').textContent = draw.winner_name; $('alternate-name').textContent = draw.alternate_name; $('draw-date').textContent = `${date(draw.created_at)} · ${draw.participant_count} katılımcı arasından seçildi.`; }
}
async function refresh() {
  if (loading || !token) return;
  loading = true; $('refresh').disabled = true;
  try { const result = await rpc('admin-data', { token }); participants = result.participants; draw = result.draw; $('login-panel').hidden = true; $('dashboard').hidden = false; $('participant-count').textContent = participants.length; renderList(); renderDraw(); }
  finally { loading = false; $('refresh').disabled = false; }
}
$('year').textContent = new Date().getFullYear();
$('admin-open').addEventListener('click', () => { location.hash = 'yonetici'; });
$('back-home').addEventListener('click', () => { location.hash = ''; });
function route() { if (location.hash === '#yonetici') showAdmin(); else { $('public-view').hidden = false; $('admin-view').hidden = true; } }
window.addEventListener('hashchange', route); route();
$('logout').addEventListener('click', () => { const old = token; logout(); if (old) rpc('logout', { token: old }).catch(() => {}); });
$('entry-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if ($('website').value) return;
  const name = $('full-name').value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)* [\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(name) || name.length < 5) return message('entry-message', 'Lütfen adını ve soyadını birlikte, yalnızca harflerle yaz.', 'error');
  const button = event.target.querySelector('button'); button.disabled = true; button.textContent = 'Kaydın alınıyor…'; message('entry-message');
  try { await rpc('register', { fullName: name }); message('entry-message', 'Katılımın alındı! Bol şans. ✦', 'success'); event.target.reset(); }
  catch (error) { message('entry-message', error.message, 'error'); }
  finally { button.disabled = false; button.textContent = 'Çekilişe katıl →'; }
});
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true; message('login-message');
  try { const result = await rpc('login', { username: $('username').value.trim(), password: $('password').value }); if (!result.ok) throw new Error('Giriş yapılamadı. Bilgilerini kontrol et veya 15 dakika sonra yeniden dene.'); saveToken(result.token); $('password').value = ''; await refresh(); }
  catch (error) { message('login-message', error.message, 'error'); }
  finally { button.disabled = false; }
});
$('refresh').addEventListener('click', () => { message('admin-message'); refresh().catch(e => message('admin-message', e.message, 'error')); });
$('search').addEventListener('input', renderList);
$('draw-button').addEventListener('click', () => { if (!draw && !drawing && participants.length >= 2) $('confirm-draw').showModal(); });
$('cancel-draw').addEventListener('click', () => $('confirm-draw').close());
$('confirm-button').addEventListener('click', async () => {
  $('confirm-draw').close(); if (drawing || draw) return; drawing = true; renderDraw(); message('admin-message');
  try { draw = await rpc('draw', { token }); renderDraw(); message('admin-message', 'Çekiliş tamamlandı. Kazananlar kaydedildi.', 'success'); }
  catch (error) { message('admin-message', error.message, 'error'); try { await refresh(); } catch {} }
  finally { drawing = false; renderDraw(); }
});
if (configured) rpc('status').then(status => { if (status.closed) { $('entry-form').hidden = true; message('entry-message', 'Bu çekiliş tamamlandı. İlgin için teşekkür ederiz.', 'success'); } }).catch(() => {});
