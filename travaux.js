// ============================================================
// MODULE — Travaux
// Remplace : Répartition_des_comptes.xlsx > "Travaux Maison 06" + "Travaux inondations"
//
// Modèle de données :
//   collection "chantiers" : { nom, financement: 'pret'|'fonds_propres' }
//   collection "depensesTravaux" : { chantierId, date, libelle, montant }
// ============================================================

let travState = {
  chantiers: [],
  depenses: [],
  selectedId: null
};

async function renderTravaux(container) {
  await withErrorToast(async () => {
    travState.chantiers = await fetchAll('chantiers');
    travState.depenses = await fetchAll('depensesTravaux');
    if (!travState.selectedId && travState.chantiers.length > 0) {
      travState.selectedId = travState.chantiers[0].id;
    }
    drawTravaux(container);
  });
}

function coutChantier(chantierId) {
  return travState.depenses
    .filter(d => d.chantierId === chantierId)
    .reduce((s, d) => s + Number(d.montant || 0), 0);
}

function drawTravaux(container) {
  const totalGeneral = travState.chantiers.reduce((s, c) => s + coutChantier(c.id), 0);

  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2>Travaux</h2>
        <p>Chantiers (maison, dégâts des eaux…) et leur financement.</p>
      </div>
      <button class="btn btn-primary" id="trav-add-btn">+ Nouveau chantier</button>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="label">Coût total tous chantiers</div><div class="value negative">${formatEUR(totalGeneral)}</div></div>
      <div class="stat-card"><div class="label">Nombre de chantiers</div><div class="value">${travState.chantiers.length}</div></div>
    </div>

    ${travState.chantiers.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          <div class="glyph">🔨</div>
          <p>Aucun chantier enregistré.</p>
          <p>Crée ton premier chantier (ex: "Maison", "Dégâts des eaux"…).</p>
        </div>
      </div>
    ` : `
      <div class="subtabs" id="trav-tabs">
        ${travState.chantiers.map(c => `<button data-id="${c.id}" class="${c.id === travState.selectedId ? 'active' : ''}">${esc(c.nom)}</button>`).join('')}
      </div>
      ${drawChantierDetail()}
    `}
  `;

  document.getElementById('trav-add-btn').addEventListener('click', () => openChantierForm());
  container.querySelectorAll('#trav-tabs button').forEach(btn => {
    btn.addEventListener('click', () => { travState.selectedId = btn.dataset.id; drawTravaux(container); });
  });
  const editBtn = container.querySelector('[data-edit-chantier]');
  if (editBtn) editBtn.addEventListener('click', () => openChantierForm(travState.chantiers.find(c => c.id === travState.selectedId)));
  const delBtn = container.querySelector('[data-del-chantier]');
  if (delBtn) delBtn.addEventListener('click', () => deleteChantier(travState.selectedId, container));
  const addDepBtn = container.querySelector('#dep-trav-add-btn');
  if (addDepBtn) addDepBtn.addEventListener('click', () => openDepenseTravauxForm());
  container.querySelectorAll('[data-del-dep-trav]').forEach(btn => {
    btn.addEventListener('click', () => deleteDepenseTravaux(btn.dataset.delDepTrav, container));
  });
}

function drawChantierDetail() {
  const chantier = travState.chantiers.find(c => c.id === travState.selectedId);
  if (!chantier) return '';

  const deps = travState.depenses
    .filter(d => d.chantierId === chantier.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const financementLabel = chantier.financement === 'pret' ? 'Financé par prêt' : 'Fonds propres';

  return `
    <div class="card">
      <div class="module-header" style="margin-bottom:10px;">
        <h3 class="mt-0">${esc(chantier.nom)} <span class="pill ${chantier.financement === 'pret' ? 'pill-gold' : 'pill-accent'}" style="margin-left:8px;">${financementLabel}</span></h3>
        <div class="flex gap-8">
          <button class="btn" data-edit-chantier>✏️ Modifier</button>
          <button class="btn btn-danger" data-del-chantier>🗑️ Supprimer</button>
          <button class="btn btn-primary" id="dep-trav-add-btn">+ Dépense</button>
        </div>
      </div>
      <p class="text-soft" style="margin-bottom:18px; font-size:0.9rem;">
        Coût total à date : <strong style="font-family:var(--font-data); color:var(--warn);">${formatEUR(coutChantier(chantier.id))}</strong>
      </p>

      ${deps.length === 0 ? `
        <div class="empty-state"><p>Aucune dépense enregistrée pour ce chantier.</p></div>
      ` : `
        <table>
          <thead><tr><th>Date</th><th>Libellé</th><th>Montant</th><th></th></tr></thead>
          <tbody>
            ${deps.map(d => `
              <tr>
                <td>${formatDateFR(d.date)}</td>
                <td>${esc(d.libelle)}</td>
                <td class="amount negative">${formatEUR(d.montant)}</td>
                <td class="row-actions"><button class="icon-btn" data-del-dep-trav="${d.id}" title="Supprimer">🗑️</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

function openChantierForm(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? 'Modifier le chantier' : 'Nouveau chantier'}</h3>
    <form id="chantier-form">
      <div style="margin-bottom:12px;">
        <label>Nom</label>
        <input type="text" id="chantier-nom" required value="${existing ? esc(existing.nom) : ''}" placeholder="Ex: Maison principale">
      </div>
      <div style="margin-bottom:16px;">
        <label>Financement</label>
        <select id="chantier-financement">
          <option value="fonds_propres" ${existing && existing.financement === 'fonds_propres' ? 'selected' : ''}>Fonds propres</option>
          <option value="pret" ${existing && existing.financement === 'pret' ? 'selected' : ''}>Prêt</option>
        </select>
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#chantier-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        nom: modal.querySelector('#chantier-nom').value.trim(),
        financement: modal.querySelector('#chantier-financement').value
      };
      await withErrorToast(async () => {
        if (isEdit) {
          await updateDoc('chantiers', existing.id, data);
          showToast('Chantier modifié');
        } else {
          const ref = await addDoc('chantiers', data);
          travState.selectedId = ref.id;
          showToast('Chantier créé');
        }
        closeModal();
        await renderTravaux(document.getElementById('module-content'));
      });
    });
  });
}

function openDepenseTravauxForm() {
  showModal(`
    <h3>Nouvelle dépense</h3>
    <form id="dep-trav-form">
      <div class="form-grid" style="margin-bottom:12px;">
        <div>
          <label>Date</label>
          <input type="date" id="dep-trav-date" required value="${todayISO()}">
        </div>
        <div class="field-amount">
          <label>Montant (€)</label>
          <input type="number" step="0.01" id="dep-trav-montant" required>
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <label>Libellé</label>
        <input type="text" id="dep-trav-libelle" required placeholder="Ex: Devis plombier">
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">Ajouter</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#dep-trav-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        chantierId: travState.selectedId,
        date: modal.querySelector('#dep-trav-date').value,
        montant: parseFloat(modal.querySelector('#dep-trav-montant').value),
        libelle: modal.querySelector('#dep-trav-libelle').value.trim()
      };
      await withErrorToast(async () => {
        await addDoc('depensesTravaux', data);
        showToast('Dépense ajoutée');
        closeModal();
        await renderTravaux(document.getElementById('module-content'));
      });
    });
  });
}

async function deleteChantier(id, container) {
  if (!confirm('Supprimer ce chantier et toutes ses dépenses ?')) return;
  await withErrorToast(async () => {
    const deps = travState.depenses.filter(d => d.chantierId === id);
    await Promise.all(deps.map(d => deleteDoc('depensesTravaux', d.id)));
    await deleteDoc('chantiers', id);
    travState.selectedId = null;
    showToast('Chantier supprimé');
    await renderTravaux(container);
  });
}

async function deleteDepenseTravaux(id, container) {
  if (!confirm('Supprimer cette dépense ?')) return;
  await withErrorToast(async () => {
    await deleteDoc('depensesTravaux', id);
    showToast('Dépense supprimée');
    await renderTravaux(container);
  });
}
