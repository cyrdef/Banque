// ============================================================
// MODULE — Projets ponctuels
// Remplace : "Mariage", "Estimation Corse" (et tout futur projet
// similaire : voyage, événement…) dans Répartition_des_comptes.xlsx
//
// Modèle de données :
//   collection "projets" : { nom }
//   collection "lignesProjet" : { projetId, libelle, type: 'depense'|'recette',
//                                  montantEstime, montantReel }
// ============================================================

let projState = {
  projets: [],
  lignes: [],
  selectedId: null
};

async function renderProjets(container) {
  await withErrorToast(async () => {
    projState.projets = await fetchAll('projets');
    projState.lignes = await fetchAll('lignesProjet');
    if (!projState.selectedId && projState.projets.length > 0) {
      projState.selectedId = projState.projets[0].id;
    }
    drawProjets(container);
  });
}

function totauxProjet(projetId) {
  const lignes = projState.lignes.filter(l => l.projetId === projetId);
  const sum = (type, field) => lignes.filter(l => l.type === type).reduce((s, l) => s + Number(l[field] || 0), 0);
  return {
    depensesEstime: sum('depense', 'montantEstime'),
    depensesReel: sum('depense', 'montantReel'),
    recettesEstime: sum('recette', 'montantEstime'),
    recettesReel: sum('recette', 'montantReel'),
  };
}

function drawProjets(container) {
  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2>Projets ponctuels</h2>
        <p>Mariage, voyages, événements… budget estimé vs réel.</p>
      </div>
      <button class="btn btn-primary" id="proj-add-btn">+ Nouveau projet</button>
    </div>

    ${projState.projets.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          <div class="glyph">💍</div>
          <p>Aucun projet pour le moment.</p>
          <p>Crée un projet (ex: "Mariage", "Voyage en Corse"…).</p>
        </div>
      </div>
    ` : `
      <div class="subtabs" id="proj-tabs">
        ${projState.projets.map(p => `<button data-id="${p.id}" class="${p.id === projState.selectedId ? 'active' : ''}">${esc(p.nom)}</button>`).join('')}
      </div>
      ${drawProjetDetail()}
    `}
  `;

  document.getElementById('proj-add-btn').addEventListener('click', () => openProjetForm());
  container.querySelectorAll('#proj-tabs button').forEach(btn => {
    btn.addEventListener('click', () => { projState.selectedId = btn.dataset.id; drawProjets(container); });
  });
  const editBtn = container.querySelector('[data-edit-proj]');
  if (editBtn) editBtn.addEventListener('click', () => openProjetForm(projState.projets.find(p => p.id === projState.selectedId)));
  const delBtn = container.querySelector('[data-del-proj]');
  if (delBtn) delBtn.addEventListener('click', () => deleteProjet(projState.selectedId, container));
  const addLigneBtn = container.querySelector('#ligne-proj-add-btn');
  if (addLigneBtn) addLigneBtn.addEventListener('click', () => openLigneProjetForm());
  container.querySelectorAll('[data-edit-ligne]').forEach(btn => {
    btn.addEventListener('click', () => openLigneProjetForm(projState.lignes.find(l => l.id === btn.dataset.editLigne)));
  });
  container.querySelectorAll('[data-del-ligne]').forEach(btn => {
    btn.addEventListener('click', () => deleteLigneProjet(btn.dataset.delLigne, container));
  });
}

function drawProjetDetail() {
  const projet = projState.projets.find(p => p.id === projState.selectedId);
  if (!projet) return '';

  const t = totauxProjet(projet.id);
  const soldeEstime = t.recettesEstime - t.depensesEstime;
  const soldeReel = t.recettesReel - t.depensesReel;

  const lignesDep = projState.lignes.filter(l => l.projetId === projet.id && l.type === 'depense');
  const lignesRec = projState.lignes.filter(l => l.projetId === projet.id && l.type === 'recette');

  return `
    <div class="module-header" style="margin-bottom:10px;">
      <h3 class="mt-0">${esc(projet.nom)}</h3>
      <div class="flex gap-8">
        <button class="btn" data-edit-proj>✏️ Modifier</button>
        <button class="btn btn-danger" data-del-proj>🗑️ Supprimer</button>
        <button class="btn btn-primary" id="ligne-proj-add-btn">+ Ligne</button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="label">Solde estimé</div><div class="value ${soldeEstime >= 0 ? 'positive' : 'negative'}">${formatEUR(soldeEstime)}</div></div>
      <div class="stat-card"><div class="label">Solde réel</div><div class="value ${soldeReel >= 0 ? 'positive' : 'negative'}">${formatEUR(soldeReel)}</div></div>
    </div>

    <div class="card">
      <h3>Dépenses</h3>
      ${lignesDep.length === 0 ? `<div class="empty-state"><p>Aucune dépense.</p></div>` : `
        <table>
          <thead><tr><th>Libellé</th><th>Estimé</th><th>Réel</th><th></th></tr></thead>
          <tbody>${lignesDep.map(rowLigneProjet).join('')}</tbody>
        </table>
      `}
    </div>

    <div class="card">
      <h3>Recettes</h3>
      ${lignesRec.length === 0 ? `<div class="empty-state"><p>Aucune recette.</p></div>` : `
        <table>
          <thead><tr><th>Libellé</th><th>Estimé</th><th>Réel</th><th></th></tr></thead>
          <tbody>${lignesRec.map(rowLigneProjet).join('')}</tbody>
        </table>
      `}
    </div>
  `;
}

function rowLigneProjet(l) {
  const cls = l.type === 'depense' ? 'negative' : 'positive';
  return `
    <tr>
      <td>${esc(l.libelle)}</td>
      <td class="amount ${cls}">${formatEUR(l.montantEstime)}</td>
      <td class="amount ${cls}">${l.montantReel !== undefined && l.montantReel !== null && l.montantReel !== '' ? formatEUR(l.montantReel) : '—'}</td>
      <td class="row-actions">
        <button class="icon-btn" data-edit-ligne="${l.id}" title="Modifier">✏️</button>
        <button class="icon-btn" data-del-ligne="${l.id}" title="Supprimer">🗑️</button>
      </td>
    </tr>
  `;
}

function openProjetForm(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? 'Modifier le projet' : 'Nouveau projet'}</h3>
    <form id="proj-form">
      <div style="margin-bottom:16px;">
        <label>Nom du projet</label>
        <input type="text" id="proj-nom" required value="${existing ? esc(existing.nom) : ''}" placeholder="Ex: Mariage">
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#proj-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = { nom: modal.querySelector('#proj-nom').value.trim() };
      await withErrorToast(async () => {
        if (isEdit) {
          await updateDoc('projets', existing.id, data);
          showToast('Projet modifié');
        } else {
          const ref = await addDoc('projets', data);
          projState.selectedId = ref.id;
          showToast('Projet créé');
        }
        closeModal();
        await renderProjets(document.getElementById('module-content'));
      });
    });
  });
}

function openLigneProjetForm(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? 'Modifier la ligne' : 'Nouvelle ligne'}</h3>
    <form id="ligne-proj-form">
      <div style="margin-bottom:12px;">
        <label>Libellé</label>
        <input type="text" id="ligne-libelle" required value="${existing ? esc(existing.libelle) : ''}" placeholder="Ex: Traiteur">
      </div>
      <div style="margin-bottom:12px;">
        <label>Type</label>
        <select id="ligne-type">
          <option value="depense" ${existing && existing.type === 'depense' ? 'selected' : ''}>Dépense</option>
          <option value="recette" ${existing && existing.type === 'recette' ? 'selected' : ''}>Recette</option>
        </select>
      </div>
      <div class="form-grid" style="margin-bottom:16px;">
        <div class="field-amount">
          <label>Montant estimé (€)</label>
          <input type="number" step="0.01" id="ligne-estime" value="${existing && existing.montantEstime !== undefined ? existing.montantEstime : ''}">
        </div>
        <div class="field-amount">
          <label>Montant réel (€) — optionnel</label>
          <input type="number" step="0.01" id="ligne-reel" value="${existing && existing.montantReel !== undefined ? existing.montantReel : ''}">
        </div>
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#ligne-proj-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const reelVal = modal.querySelector('#ligne-reel').value;
      const data = {
        projetId: projState.selectedId,
        libelle: modal.querySelector('#ligne-libelle').value.trim(),
        type: modal.querySelector('#ligne-type').value,
        montantEstime: parseFloat(modal.querySelector('#ligne-estime').value) || 0,
        montantReel: reelVal === '' ? null : parseFloat(reelVal)
      };
      await withErrorToast(async () => {
        if (isEdit) {
          await updateDoc('lignesProjet', existing.id, data);
          showToast('Ligne modifiée');
        } else {
          await addDoc('lignesProjet', data);
          showToast('Ligne ajoutée');
        }
        closeModal();
        await renderProjets(document.getElementById('module-content'));
      });
    });
  });
}

async function deleteProjet(id, container) {
  if (!confirm('Supprimer ce projet et toutes ses lignes ?')) return;
  await withErrorToast(async () => {
    const lignes = projState.lignes.filter(l => l.projetId === id);
    await Promise.all(lignes.map(l => deleteDoc('lignesProjet', l.id)));
    await deleteDoc('projets', id);
    projState.selectedId = null;
    showToast('Projet supprimé');
    await renderProjets(container);
  });
}

async function deleteLigneProjet(id, container) {
  if (!confirm('Supprimer cette ligne ?')) return;
  await withErrorToast(async () => {
    await deleteDoc('lignesProjet', id);
    showToast('Ligne supprimée');
    await renderProjets(container);
  });
}
