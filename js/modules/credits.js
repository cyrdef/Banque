// ============================================================
// MODULE — Crédits internes
// Remplace : Répartition_des_comptes.xlsx > "Remboursement Crédit interne"
//
// Modèle de données :
//   collection "credits" : { nom, montantTotal, dateDebut }
//   collection "remboursements" : { creditId, date, montant }
// ============================================================

let credState = {
  credits: [],
  remboursements: [],
  selectedId: null
};

async function renderCredits(container) {
  await withErrorToast(async () => {
    credState.credits = await fetchAll('credits');
    credState.remboursements = await fetchAll('remboursements');
    if (!credState.selectedId && credState.credits.length > 0) {
      credState.selectedId = credState.credits[0].id;
    }
    drawCredits(container);
  });
}

function rembourseCredit(creditId) {
  return credState.remboursements
    .filter(r => r.creditId === creditId)
    .reduce((s, r) => s + Number(r.montant || 0), 0);
}

function drawCredits(container) {
  const totalDu = credState.credits.reduce((s, c) => s + Number(c.montantTotal || 0), 0);
  const totalRembourse = credState.credits.reduce((s, c) => s + rembourseCredit(c.id), 0);
  const totalRestant = totalDu - totalRembourse;

  container.innerHTML = `
    <div class="module-header">
      <div>
        <h2>Crédits internes</h2>
        <p>Avances et remboursements entre vous (mutuelle, voiture, frigo, alarme…).</p>
      </div>
      <button class="btn btn-primary" id="cred-add-btn">+ Nouveau crédit</button>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="label">Total avancé</div><div class="value">${formatEUR(totalDu)}</div></div>
      <div class="stat-card"><div class="label">Total remboursé</div><div class="value positive">${formatEUR(totalRembourse)}</div></div>
      <div class="stat-card"><div class="label">Reste à rembourser</div><div class="value ${totalRestant > 0 ? 'negative' : 'positive'}">${formatEUR(totalRestant)}</div></div>
    </div>

    ${credState.credits.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          <div class="glyph">💳</div>
          <p>Aucun crédit interne enregistré.</p>
          <p>Crée un crédit pour suivre une avance à rembourser (ex: "Mutuelle", "Voiture"…).</p>
        </div>
      </div>
    ` : `
      <div class="subtabs" id="cred-tabs">
        ${credState.credits.map(c => {
          const reste = Number(c.montantTotal || 0) - rembourseCredit(c.id);
          return `<button data-id="${c.id}" class="${c.id === credState.selectedId ? 'active' : ''}">${esc(c.nom)} ${reste <= 0 ? '✓' : ''}</button>`;
        }).join('')}
      </div>
      ${drawCreditDetail()}
    `}
  `;

  document.getElementById('cred-add-btn').addEventListener('click', () => openCreditForm());
  container.querySelectorAll('#cred-tabs button').forEach(btn => {
    btn.addEventListener('click', () => { credState.selectedId = btn.dataset.id; drawCredits(container); });
  });
  const editBtn = container.querySelector('[data-edit-cred]');
  if (editBtn) editBtn.addEventListener('click', () => openCreditForm(credState.credits.find(c => c.id === credState.selectedId)));
  const delBtn = container.querySelector('[data-del-cred]');
  if (delBtn) delBtn.addEventListener('click', () => deleteCredit(credState.selectedId, container));
  const addRembBtn = container.querySelector('#remb-add-btn');
  if (addRembBtn) addRembBtn.addEventListener('click', () => openRemboursementForm());
  container.querySelectorAll('[data-del-remb]').forEach(btn => {
    btn.addEventListener('click', () => deleteRemboursement(btn.dataset.delRemb, container));
  });
}

function drawCreditDetail() {
  const credit = credState.credits.find(c => c.id === credState.selectedId);
  if (!credit) return '';

  const remb = credState.remboursements
    .filter(r => r.creditId === credit.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const total = Number(credit.montantTotal || 0);
  const rembourse = rembourseCredit(credit.id);
  const reste = total - rembourse;
  const pct = total > 0 ? Math.min(100, Math.round((rembourse / total) * 100)) : 0;

  return `
    <div class="card">
      <div class="module-header" style="margin-bottom:10px;">
        <h3 class="mt-0">${esc(credit.nom)}</h3>
        <div class="flex gap-8">
          <button class="btn" data-edit-cred>✏️ Modifier</button>
          <button class="btn btn-danger" data-del-cred>🗑️ Supprimer</button>
          <button class="btn btn-primary" id="remb-add-btn">+ Remboursement</button>
        </div>
      </div>

      <div style="background:var(--line); border-radius:8px; height:8px; overflow:hidden; margin-bottom:14px;">
        <div style="background:${reste <= 0 ? 'var(--accent)' : 'var(--gold)'}; height:100%; width:${pct}%;"></div>
      </div>
      <p class="text-soft" style="margin-bottom:18px; font-size:0.85rem;">
        ${formatEUR(rembourse)} remboursé sur ${formatEUR(total)} (${pct}%) — reste <strong>${formatEUR(Math.max(0, reste))}</strong>
      </p>

      ${remb.length === 0 ? `
        <div class="empty-state"><p>Aucun remboursement enregistré.</p></div>
      ` : `
        <table>
          <thead><tr><th>Date</th><th>Montant remboursé</th><th></th></tr></thead>
          <tbody>
            ${remb.map(r => `
              <tr>
                <td>${formatDateFR(r.date)}</td>
                <td class="amount positive">${formatEUR(r.montant)}</td>
                <td class="row-actions"><button class="icon-btn" data-del-remb="${r.id}" title="Supprimer">🗑️</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

function openCreditForm(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? 'Modifier le crédit' : 'Nouveau crédit'}</h3>
    <form id="cred-form">
      <div style="margin-bottom:12px;">
        <label>Nom</label>
        <input type="text" id="cred-nom" required value="${existing ? esc(existing.nom) : ''}" placeholder="Ex: Mutuelle">
      </div>
      <div class="form-grid" style="margin-bottom:16px;">
        <div class="field-amount">
          <label>Montant total avancé (€)</label>
          <input type="number" step="0.01" id="cred-montant" required value="${existing ? existing.montantTotal : ''}">
        </div>
        <div>
          <label>Date de l'avance</label>
          <input type="date" id="cred-date" value="${existing ? existing.dateDebut || '' : todayISO()}">
        </div>
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#cred-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        nom: modal.querySelector('#cred-nom').value.trim(),
        montantTotal: parseFloat(modal.querySelector('#cred-montant').value),
        dateDebut: modal.querySelector('#cred-date').value
      };
      await withErrorToast(async () => {
        if (isEdit) {
          await updateDoc('credits', existing.id, data);
          showToast('Crédit modifié');
        } else {
          const ref = await addDoc('credits', data);
          credState.selectedId = ref.id;
          showToast('Crédit créé');
        }
        closeModal();
        await renderCredits(document.getElementById('module-content'));
      });
    });
  });
}

function openRemboursementForm() {
  showModal(`
    <h3>Nouveau remboursement</h3>
    <form id="remb-form">
      <div class="form-grid" style="margin-bottom:16px;">
        <div>
          <label>Date</label>
          <input type="date" id="remb-date" required value="${todayISO()}">
        </div>
        <div class="field-amount">
          <label>Montant remboursé (€)</label>
          <input type="number" step="0.01" id="remb-montant" required>
        </div>
      </div>
      <div class="flex gap-8" style="justify-content:flex-end;">
        <button type="button" class="btn" data-modal-cancel>Annuler</button>
        <button type="submit" class="btn btn-primary">Ajouter</button>
      </div>
    </form>
  `, (modal) => {
    modal.querySelector('#remb-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        creditId: credState.selectedId,
        date: modal.querySelector('#remb-date').value,
        montant: parseFloat(modal.querySelector('#remb-montant').value)
      };
      await withErrorToast(async () => {
        await addDoc('remboursements', data);
        showToast('Remboursement ajouté');
        closeModal();
        await renderCredits(document.getElementById('module-content'));
      });
    });
  });
}

async function deleteCredit(id, container) {
  if (!confirm('Supprimer ce crédit et tous ses remboursements ?')) return;
  await withErrorToast(async () => {
    const remb = credState.remboursements.filter(r => r.creditId === id);
    await Promise.all(remb.map(r => deleteDoc('remboursements', r.id)));
    await deleteDoc('credits', id);
    credState.selectedId = null;
    showToast('Crédit supprimé');
    await renderCredits(container);
  });
}

async function deleteRemboursement(id, container) {
  if (!confirm('Supprimer ce remboursement ?')) return;
  await withErrorToast(async () => {
    await deleteDoc('remboursements', id);
    showToast('Remboursement supprimé');
    await renderCredits(container);
  });
}
