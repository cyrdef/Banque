// ============================================================
// MODULE — Location
// Remplace : "Liste potentielle locataires" + "Locations"
//
// Modèle de données :
//   collection "locataires" : { nom, telephone, email, statut, notes }
//   collection "locations" : { locataireNom, dateDebut, dateFin, montant, notes }
// ============================================================

let locState = {
  locataires: [],
  locations: [],
  tab: 'locations' // 'locations' | 'locataires'
};

async function renderLocation(container) {
  await withErrorToast(async () => {
    locState.locataires = await fetchAll('locataires');
    locState.locations = await fetchAll('locations');
    drawLocation(container);
  });
}

function drawLocation(container) {
  const totalRecettes = locState.locations.reduce((s, l) => s + Number(l.montant || 0), 0);

  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2>Location</h2>
        <p>Suivi des locations et des locataires potentiels.</p>
      </div>
      <button class="btn btn-primary" id="loc-add-btn">
        + ${locState.tab === 'locations' ? 'Nouvelle location' : 'Nouveau contact'}
      </button>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="label">Total perçu (locations)</div><div class="value positive">${formatEUR(totalRecettes)}</div></div>
      <div class="stat-card"><div class="label">Locations enregistrées</div><div class="value">${locState.locations.length}</div></div>
      <div class="stat-card"><div class="label">Contacts locataires</div><div class="value">${locState.locataires.length}</div></div>
    </div>

    <div class="subtabs">
      <button data-tab="locations" class="${locState.tab === 'locations' ? 'active' : ''}">📆 Historique des locations</button>
      <button data-tab="locataires" class="${locState.tab === 'locataires' ? 'active' : ''}">👥 Locataires potentiels</button>
    </div>

    <div class="card">
      ${locState.tab === 'locations' ? drawLocationsTable() : drawLocatairesTable()}
    </div>
  `;

  document.getElementById('loc-add-btn').addEventListener('click', () => {
    if (locState.tab === 'locations') openLocationForm();
    else openLocataireForm();
  });

  container.querySelectorAll('.subtabs button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => { locState.tab = btn.dataset.tab; drawLocation(container); });
  });

  container.querySelectorAll('[data-edit-location]').forEach(btn => {
    btn.addEventListener('click', () => openLocationForm(locState.locations.find(l => l.id === btn.dataset.editLocation)));
  });
  container.querySelectorAll('[data-del-location]').forEach(btn => {
    btn.addEventListener('click', () => deleteLocation(btn.dataset.delLocation, container));
  });
  container.querySelectorAll('[data-edit-locataire]').forEach(btn => {
    btn.addEventListener('click', () => openLocataireForm(locState.locataires.find(l => l.id === btn.dataset.editLocataire)));
  });
  container.querySelectorAll('[data-del-locataire]').forEach(btn => {
    btn.addEventListener('click', () => deleteLocataire(btn.dataset.delLocataire, container));
  });
}

function drawLocationsTable() {
  const locations = [...locState.locations].sort((a, b) => (b.dateDebut || '').localeCompare(a.dateDebut || ''));
  if (locations.length === 0) {
    return `<div class="empty-state"><div class="glyph">🏠</div><p>Aucune location enregistrée.</p></div>`;
  }
  return `
    <table>
      <thead><tr><th>Locataire</th><th>Du</th><th>Au</th><th>Montant</th><th>Notes</th><th></th></tr></thead>
      <tbody>
        ${locations.map(l => `
          <tr>
            <td>${esc(l.locataireNom)}</td>
            <td>${formatDateFR(l.dateDebut)}</td>
            <td>${formatDateFR(l.dateFin)}</td>
            <td class="amount positive">${formatEUR(l.montant)}</td>
            <td class="text-soft">${esc(l.notes || '—')}</td>
            <td class="row-actions">
              <button class="icon-btn" data-edit-location="${l.id}" title="Modifier">✏️</button>
              <button class="icon-btn" data-del-location="${l.id}" title="Supprimer">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function drawLocatairesTable() {
  if (locState.locataires.length === 0) {
    return `<div class="empty-state"><div class="glyph">👥</div><p>Aucun contact enregistré.</p></div>`;
  }
  return `
    <table>
      <thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Statut</th><th>Notes</th><th></th></tr></thead>
      <tbody>
        ${locState.locataires.map(l => `
          <tr>
            <td>${esc(l.nom)}</td>
            <td>${esc(l.telephone || '—')}</td>
            <td>${esc(l.email || '—')}</td>
            <td>${l.statut ? `<span class="pill pill-gold">${esc(l.statut)}</span>` : '—'}</td>
            <td class="text-soft">${esc(l.notes || '—')}</td>
            <td class="row-actions">
              <button class="icon-btn" data-edit-locataire="${l.id}" title="Modifier">✏️</button>
              <button class="icon-btn" data-del-locataire="${l.id}" title="Supprimer">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openLocationForm(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? 'Modifier la location' : 'Nouvelle location'}</h3>
    <form id="location-form">
      <div style="margin-bottom:12px;">
        <label>Nom du locataire</label>
        <input type="text" id="loc-nom" required value="${existing ? esc(existing.locataireNom) : ''}" placeholder="Ex: Famille Dupont">
      </div>
      <div class="form-grid" style="margin-bottom:12px;">
        <div>
          <label>Du</label>
          <input type="date" id="loc-debut" required value="${existing ? existing.dateDebut : todayISO()}">
        </div>
        <div>
          <label>Au</label>
          <input type="date" id="loc-fin" required value="${existing ? existing.dateFin : todayISO()}">
        </div>
      </div>
      <div class="field-amount" style="margin-bottom:12px;">
        <label>Montant perçu (€)</label>
        <input type="number" step="0.01" id="loc-montant" required value="${existing ? existing.montant : ''}">
      </div>
      <div style="margin-bottom:16px;">
        <label>Notes</label>
        <input type="text" id="loc-notes" value="${existing ? esc(existing.notes || '') : ''}" placeholder="Optionnel">
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#location-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        locataireNom: modal.querySelector('#loc-nom').value.trim(),
        dateDebut: modal.querySelector('#loc-debut').value,
        dateFin: modal.querySelector('#loc-fin').value,
        montant: parseFloat(modal.querySelector('#loc-montant').value),
        notes: modal.querySelector('#loc-notes').value.trim()
      };
      await withErrorToast(async () => {
        if (isEdit) {
          await updateDoc('locations', existing.id, data);
          showToast('Location modifiée');
        } else {
          await addDoc('locations', data);
          showToast('Location ajoutée');
        }
        closeModal();
        await renderLocation(document.getElementById('module-content'));
      });
    });
  });
}

function openLocataireForm(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? 'Modifier le contact' : 'Nouveau contact'}</h3>
    <form id="locataire-form">
      <div style="margin-bottom:12px;">
        <label>Nom</label>
        <input type="text" id="locat-nom" required value="${existing ? esc(existing.nom) : ''}">
      </div>
      <div class="form-grid" style="margin-bottom:12px;">
        <div>
          <label>Téléphone</label>
          <input type="text" id="locat-tel" value="${existing ? esc(existing.telephone || '') : ''}">
        </div>
        <div>
          <label>Email</label>
          <input type="email" id="locat-email" value="${existing ? esc(existing.email || '') : ''}">
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <label>Statut</label>
        <select id="locat-statut">
          <option value="A contacter" ${existing && existing.statut === 'A contacter' ? 'selected' : ''}>À contacter</option>
          <option value="En discussion" ${existing && existing.statut === 'En discussion' ? 'selected' : ''}>En discussion</option>
          <option value="Confirmé" ${existing && existing.statut === 'Confirmé' ? 'selected' : ''}>Confirmé</option>
          <option value="Refusé" ${existing && existing.statut === 'Refusé' ? 'selected' : ''}>Refusé</option>
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label>Notes</label>
        <textarea id="locat-notes" rows="3">${existing ? esc(existing.notes || '') : ''}</textarea>
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#locataire-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        nom: modal.querySelector('#locat-nom').value.trim(),
        telephone: modal.querySelector('#locat-tel').value.trim(),
        email: modal.querySelector('#locat-email').value.trim(),
        statut: modal.querySelector('#locat-statut').value,
        notes: modal.querySelector('#locat-notes').value.trim()
      };
      await withErrorToast(async () => {
        if (isEdit) {
          await updateDoc('locataires', existing.id, data);
          showToast('Contact modifié');
        } else {
          await addDoc('locataires', data);
          showToast('Contact ajouté');
        }
        closeModal();
        await renderLocation(document.getElementById('module-content'));
      });
    });
  });
}

async function deleteLocation(id, container) {
  if (!confirm('Supprimer cette location ?')) return;
  await withErrorToast(async () => {
    await deleteDoc('locations', id);
    showToast('Location supprimée');
    await renderLocation(container);
  });
}

async function deleteLocataire(id, container) {
  if (!confirm('Supprimer ce contact ?')) return;
  await withErrorToast(async () => {
    await deleteDoc('locataires', id);
    showToast('Contact supprimé');
    await renderLocation(container);
  });
}
