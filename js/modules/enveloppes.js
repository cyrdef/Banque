// ============================================================
// MODULE — Enveloppes / cagnottes
// Remplace : Répartition_des_comptes.xlsx > feuille "Comptes"
//
// Modèle de données :
//   collection "enveloppes" : { nom, soldeInitial }
//   collection "mouvements" : { enveloppeId, date, libelle, montant }
//     montant positif = alimentation, négatif = dépense/sortie
// ============================================================

let envState = {
  enveloppes: [],
  mouvements: [],
  selectedId: null
};

async function renderEnveloppes(container) {
  await withErrorToast(async () => {
    envState.enveloppes = await fetchAll('enveloppes');
    envState.mouvements = await fetchAll('mouvements');
    if (!envState.selectedId && envState.enveloppes.length > 0) {
      envState.selectedId = envState.enveloppes[0].id;
    }
    drawEnveloppes(container);
  });
}

function soldeEnveloppe(envId) {
  const env = envState.enveloppes.find(e => e.id === envId);
  if (!env) return 0;
  const mouv = envState.mouvements.filter(m => m.enveloppeId === envId);
  return Number(env.soldeInitial || 0) + mouv.reduce((s, m) => s + Number(m.montant || 0), 0);
}

function drawEnveloppes(container) {
  const totalGeneral = envState.enveloppes.reduce((s, e) => s + soldeEnveloppe(e.id), 0);

  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2>Enveloppes</h2>
        <p>Une cagnotte par poste (UNA, eau, impôts, anniversaires…) avec son historique.</p>
      </div>
      <button class="btn btn-primary" id="env-add-btn">+ Nouvelle enveloppe</button>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="label">Total de toutes les enveloppes</div>
        <div class="value ${totalGeneral >= 0 ? 'positive' : 'negative'}">${formatEUR(totalGeneral)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Nombre d'enveloppes</div>
        <div class="value">${envState.enveloppes.length}</div>
      </div>
    </div>

    ${envState.enveloppes.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          <div class="glyph">🐷</div>
          <p>Aucune enveloppe pour le moment.</p>
          <p>Crée ta première cagnotte (ex: "Eau", "Impôts", "Anniversaires"…).</p>
        </div>
      </div>
    ` : `
      <div class="subtabs" id="env-tabs">
        ${envState.enveloppes.map(e => `
          <button data-id="${e.id}" class="${e.id === envState.selectedId ? 'active' : ''}">
            ${esc(e.nom)} · ${formatEUR(soldeEnveloppe(e.id))}
          </button>
        `).join('')}
      </div>

      ${drawEnveloppeDetail(container)}
    `}
  `;

  document.getElementById('env-add-btn').addEventListener('click', () => openEnveloppeForm());
  container.querySelectorAll('#env-tabs button').forEach(btn => {
    btn.addEventListener('click', () => { envState.selectedId = btn.dataset.id; drawEnveloppes(container); });
  });

  const editEnvBtn = container.querySelector('[data-edit-env]');
  if (editEnvBtn) editEnvBtn.addEventListener('click', () => openEnveloppeForm(envState.enveloppes.find(e => e.id === envState.selectedId)));
  const delEnvBtn = container.querySelector('[data-del-env]');
  if (delEnvBtn) delEnvBtn.addEventListener('click', () => deleteEnveloppe(envState.selectedId, container));
  const addMouvBtn = container.querySelector('#mouv-add-btn');
  if (addMouvBtn) addMouvBtn.addEventListener('click', () => openMouvementForm());

  container.querySelectorAll('[data-edit-mouv]').forEach(btn => {
    btn.addEventListener('click', () => openMouvementForm(envState.mouvements.find(m => m.id === btn.dataset.editMouv)));
  });
  container.querySelectorAll('[data-del-mouv]').forEach(btn => {
    btn.addEventListener('click', () => deleteMouvement(btn.dataset.delMouv, container));
  });
}

function drawEnveloppeDetail(container) {
  const env = envState.enveloppes.find(e => e.id === envState.selectedId);
  if (!env) return '';

  const mouv = envState.mouvements
    .filter(m => m.enveloppeId === env.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return `
    <div class="card">
      <div class="module-header" style="margin-bottom:14px;">
        <h3 class="mt-0">${esc(env.nom)} — solde : <span class="${soldeEnveloppe(env.id) >= 0 ? 'positive' : 'negative'}" style="font-family:var(--font-data);">${formatEUR(soldeEnveloppe(env.id))}</span></h3>
        <div class="flex gap-8">
          <button class="btn" data-edit-env>✏️ Modifier l'enveloppe</button>
          <button class="btn btn-danger" data-del-env>🗑️ Supprimer</button>
          <button class="btn btn-primary" id="mouv-add-btn">+ Mouvement</button>
        </div>
      </div>

      ${mouv.length === 0 ? `
        <div class="empty-state">
          <div class="glyph">📭</div>
          <p>Aucun mouvement enregistré pour cette enveloppe.</p>
        </div>
      ` : `
        <table>
          <thead><tr><th>Date</th><th>Libellé</th><th>Montant</th><th></th></tr></thead>
          <tbody>
            ${mouv.map(m => `
              <tr>
                <td>${formatDateFR(m.date)}</td>
                <td>${esc(m.libelle)}</td>
                <td class="amount ${Number(m.montant) >= 0 ? 'positive' : 'negative'}">${Number(m.montant) >= 0 ? '+' : ''}${formatEUR(m.montant)}</td>
                <td class="row-actions">
                  <button class="icon-btn" data-edit-mouv="${m.id}" title="Modifier">✏️</button>
                  <button class="icon-btn" data-del-mouv="${m.id}" title="Supprimer">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

function openEnveloppeForm(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? "Modifier l'enveloppe" : 'Nouvelle enveloppe'}</h3>
    <form id="env-form">
      <div class="form-grid" style="margin-bottom:16px;">
        <div>
          <label>Nom</label>
          <input type="text" id="env-nom" required value="${existing ? esc(existing.nom) : ''}" placeholder="Ex: Impôts">
        </div>
        <div class="field-amount">
          <label>Solde de départ (€)</label>
          <input type="number" step="0.01" id="env-solde" value="${existing ? existing.soldeInitial : 0}">
        </div>
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#env-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        nom: modal.querySelector('#env-nom').value.trim(),
        soldeInitial: parseFloat(modal.querySelector('#env-solde').value) || 0
      };
      await withErrorToast(async () => {
        if (isEdit) {
          await updateDoc('enveloppes', existing.id, data);
          showToast('Enveloppe modifiée');
        } else {
          const ref = await addDoc('enveloppes', data);
          envState.selectedId = ref.id;
          showToast('Enveloppe créée');
        }
        closeModal();
        await renderEnveloppes(document.getElementById('module-content'));
      });
    });
  });
}

function openMouvementForm(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? 'Modifier le mouvement' : 'Nouveau mouvement'}</h3>
    <form id="mouv-form">
      <div class="form-grid" style="margin-bottom:12px;">
        <div>
          <label>Date</label>
          <input type="date" id="mouv-date" required value="${existing ? existing.date : todayISO()}">
        </div>
        <div class="field-amount">
          <label>Montant (€) — positif = alimentation, négatif = sortie</label>
          <input type="number" step="0.01" id="mouv-montant" required value="${existing ? existing.montant : ''}">
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <label>Libellé</label>
        <input type="text" id="mouv-libelle" required value="${existing ? esc(existing.libelle) : ''}" placeholder="Ex: Facture EDF de janvier">
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#mouv-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        enveloppeId: envState.selectedId,
        date: modal.querySelector('#mouv-date').value,
        montant: parseFloat(modal.querySelector('#mouv-montant').value),
        libelle: modal.querySelector('#mouv-libelle').value.trim()
      };
      await withErrorToast(async () => {
        if (isEdit) {
          await updateDoc('mouvements', existing.id, data);
          showToast('Mouvement modifié');
        } else {
          await addDoc('mouvements', data);
          showToast('Mouvement ajouté');
        }
        closeModal();
        await renderEnveloppes(document.getElementById('module-content'));
      });
    });
  });
}

async function deleteEnveloppe(id, container) {
  if (!confirm("Supprimer cette enveloppe et tous ses mouvements ?")) return;
  await withErrorToast(async () => {
    const mouv = envState.mouvements.filter(m => m.enveloppeId === id);
    await Promise.all(mouv.map(m => deleteDoc('mouvements', m.id)));
    await deleteDoc('enveloppes', id);
    envState.selectedId = null;
    showToast('Enveloppe supprimée');
    await renderEnveloppes(container);
  });
}

async function deleteMouvement(id, container) {
  if (!confirm('Supprimer ce mouvement ?')) return;
  await withErrorToast(async () => {
    await deleteDoc('mouvements', id);
    showToast('Mouvement supprimé');
    await renderEnveloppes(container);
  });
}
