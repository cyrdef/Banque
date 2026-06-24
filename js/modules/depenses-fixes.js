// ============================================================
// MODULE — Dépenses fixes mensuelles
// Remplace : Comptes_Mensuel.xlsx (feuilles par année + Budget mensuel)
//
// Modèle de données (collection "depensesFixes") :
//   { designation, montant, categorie, recurrente: bool,
//     annee, mois (1-12), type: 'depense'|'recette' }
// ============================================================

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

let dfState = {
  annee: new Date().getFullYear(),
  mois: new Date().getMonth() + 1,
  items: []
};

async function renderDepensesFixes(container) {
  await withErrorToast(async () => {
    dfState.items = await fetchAll('depensesFixes');
    drawDepensesFixes(container);
  });
}

function drawDepensesFixes(container) {
  const annees = uniqueSorted(dfState.items.map(i => i.annee).concat([dfState.annee]));
  const itemsMois = dfState.items.filter(i => i.annee === dfState.annee && i.mois === dfState.mois);

  const totalDepenses = itemsMois.filter(i => i.type === 'depense').reduce((s, i) => s + Number(i.montant || 0), 0);
  const totalRecettes = itemsMois.filter(i => i.type === 'recette').reduce((s, i) => s + Number(i.montant || 0), 0);
  const solde = totalRecettes - totalDepenses;

  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2>Dépenses fixes mensuelles</h2>
        <p>Tes charges récurrentes et ponctuelles, mois par mois.</p>
      </div>
      <button class="btn btn-primary" id="df-add-btn">+ Ajouter une ligne</button>
    </div>

    <div class="subtabs" id="df-annee-tabs">
      ${annees.map(a => `<button data-annee="${a}" class="${a === dfState.annee ? 'active' : ''}">${a}</button>`).join('')}
      <button id="df-annee-add" title="Ajouter une année">+ année</button>
    </div>

    <div class="subtabs" id="df-mois-tabs">
      ${MOIS_LABELS.map((m, idx) => `<button data-mois="${idx + 1}" class="${idx + 1 === dfState.mois ? 'active' : ''}">${m}</button>`).join('')}
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="label">Recettes du mois</div>
        <div class="value positive">${formatEUR(totalRecettes)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Dépenses du mois</div>
        <div class="value negative">${formatEUR(totalDepenses)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Solde</div>
        <div class="value ${solde >= 0 ? 'positive' : 'negative'}">${formatEUR(solde)}</div>
      </div>
    </div>

    <div class="card">
      <h3>${MOIS_LABELS[dfState.mois - 1]} ${dfState.annee}</h3>
      ${itemsMois.length === 0 ? `
        <div class="empty-state">
          <div class="glyph">📭</div>
          <p>Aucune ligne pour ce mois.</p>
          <p>Ajoute tes charges (prêt, assurances, courses…) avec le bouton ci-dessus.</p>
        </div>
      ` : `
        <table>
          <thead><tr><th>Désignation</th><th>Catégorie</th><th>Type</th><th>Récurrente</th><th>Montant</th><th></th></tr></thead>
          <tbody>
            ${itemsMois.map(rowDF).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  // Listeners
  document.getElementById('df-add-btn').addEventListener('click', () => openDFForm());
  document.getElementById('df-annee-add').addEventListener('click', () => {
    const a = prompt('Nouvelle année (ex: 2027) :', String(dfState.annee + 1));
    if (a && /^\d{4}$/.test(a.trim())) {
      dfState.annee = parseInt(a.trim(), 10);
      drawDepensesFixes(container);
    }
  });

  container.querySelectorAll('#df-annee-tabs button[data-annee]').forEach(btn => {
    btn.addEventListener('click', () => { dfState.annee = parseInt(btn.dataset.annee, 10); drawDepensesFixes(container); });
  });
  container.querySelectorAll('#df-mois-tabs button[data-mois]').forEach(btn => {
    btn.addEventListener('click', () => { dfState.mois = parseInt(btn.dataset.mois, 10); drawDepensesFixes(container); });
  });
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openDFForm(dfState.items.find(i => i.id === btn.dataset.edit)));
  });
  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteDF(btn.dataset.del, container));
  });
}

function rowDF(item) {
  const isDep = item.type === 'depense';
  return `
    <tr>
      <td>${esc(item.designation)}</td>
      <td>${item.categorie ? `<span class="pill pill-gold">${esc(item.categorie)}</span>` : '—'}</td>
      <td>${isDep ? '<span class="pill pill-warn">Dépense</span>' : '<span class="pill pill-accent">Recette</span>'}</td>
      <td>${item.recurrente ? 'Oui' : 'Non'}</td>
      <td class="amount ${isDep ? 'negative' : 'positive'}">${isDep ? '-' : '+'}${formatEUR(item.montant)}</td>
      <td class="row-actions">
        <button class="icon-btn" data-edit="${item.id}" title="Modifier">✏️</button>
        <button class="icon-btn" data-del="${item.id}" title="Supprimer">🗑️</button>
      </td>
    </tr>
  `;
}

function openDFForm(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? 'Modifier la ligne' : 'Nouvelle ligne'}</h3>
    <form id="df-form">
      <div class="form-grid" style="margin-bottom:12px;">
        <div>
          <label>Désignation</label>
          <input type="text" id="df-designation" required value="${existing ? esc(existing.designation) : ''}" placeholder="Ex: Prêt maison">
        </div>
        <div class="field-amount">
          <label>Montant (€)</label>
          <input type="number" step="0.01" id="df-montant" required value="${existing ? existing.montant : ''}">
        </div>
      </div>
      <div class="form-grid" style="margin-bottom:12px;">
        <div>
          <label>Type</label>
          <select id="df-type">
            <option value="depense" ${existing && existing.type === 'depense' ? 'selected' : ''}>Dépense</option>
            <option value="recette" ${existing && existing.type === 'recette' ? 'selected' : ''}>Recette</option>
          </select>
        </div>
        <div>
          <label>Catégorie</label>
          <input type="text" id="df-categorie" value="${existing ? esc(existing.categorie || '') : ''}" placeholder="Ex: Logement">
        </div>
      </div>
      <div class="form-grid" style="margin-bottom:16px;">
        <div>
          <label><input type="checkbox" id="df-recurrente" ${existing && existing.recurrente ? 'checked' : ''} style="width:auto;display:inline;margin-right:6px;">Récurrente chaque mois</label>
        </div>
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#df-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        designation: modal.querySelector('#df-designation').value.trim(),
        montant: parseFloat(modal.querySelector('#df-montant').value),
        type: modal.querySelector('#df-type').value,
        categorie: modal.querySelector('#df-categorie').value.trim(),
        recurrente: modal.querySelector('#df-recurrente').checked,
        annee: dfState.annee,
        mois: dfState.mois
      };

      await withErrorToast(async () => {
        if (isEdit) {
          await updateDoc('depensesFixes', existing.id, data);
          showToast('Ligne modifiée');
        } else {
          await addDoc('depensesFixes', data);
          showToast('Ligne ajoutée');
        }
        closeModal();
        await renderDepensesFixes(document.getElementById('module-content'));
      });
    });
  });
}

async function deleteDF(id, container) {
  if (!confirm('Supprimer cette ligne ?')) return;
  await withErrorToast(async () => {
    await deleteDoc('depensesFixes', id);
    showToast('Ligne supprimée');
    await renderDepensesFixes(container);
  });
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a - b);
}
