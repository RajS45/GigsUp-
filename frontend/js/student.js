(() => {
  if (!GigsUp.requireRole('STUDENT')) return;

  const $ = id => document.getElementById(id);
  const msg = $('dashMessage');
  const reviewedShifts = new Set();

  const user = GigsUp.getUser();
  const studentId = Number(user?.userId);

  function escape(value) {
    return GigsUp.escape(value ?? '');
  }

  function statusOf(shift) {
    return String(shift.status || '').toUpperCase();
  }

  function render(target, data) {
    const el = $(target);

    if (!Array.isArray(data) || !data.length) {
      el.innerHTML = '<div class="empty-state">No shifts returned for this section.</div>';
      return;
    }

    el.innerHTML = data.map(s => {
      const status = statusOf(s);
      const shiftId = Number(s.id);
      const vendorId = Number(s.vendorId);

      return `
        <article class="shift-item">
          <div>
            <h3>${escape(s.title || 'Untitled shift')}</h3>
            <p>${escape(s.description || 'No description provided')}</p>
            <p>
              Vendor: ${escape(s.vendorName || 'Business')}
              · ${escape(GigsUp.date(s.startTime))}
              – ${escape(GigsUp.date(s.endTime))}
            </p>

            ${target === 'acceptedResults' && status === 'COMPLETED'
          ? `
                <div class="student-job-feedback"
                     data-job-feedback="${shiftId}">
                  Loading feedback for this completed job…
                </div>
              `
          : ''}
          </div>

          <div class="shift-meta">
            <span class="shift-pay">
              ${escape(GigsUp.money(s.payRate))}
            </span>

            <span class="shift-status">${escape(s.status || 'UNKNOWN')}</span>

            ${target === 'matchResults' && status === 'OPEN'
          ? `
                <button class="btn btn-primary accept-shift"
                        data-shift-id="${shiftId}">
                  Accept Shift
                </button>
              `
          : ''}

            ${target === 'acceptedResults' && status === 'MATCHED'
          ? `
                <button class="btn btn-primary complete-shift"
                        data-shift-id="${shiftId}">
                  Complete Shift
                </button>
              `
          : ''}

            ${target === 'acceptedResults' && status === 'COMPLETED'
          ? `
                <button class="btn btn-primary rate-vendor"
                        data-shift-id="${shiftId}"
                        data-vendor-id="${vendorId}"
                        data-vendor-name="${escape(s.vendorName || 'Vendor')}">
                  ⭐ Rate Vendor
                </button>

                <div class="vendor-rating"
                     data-vendor-rating="${vendorId}">
                  Loading vendor rating…
                </div>
              `
          : ''}
          </div>
        </article>
      `;
    }).join('');

    if (target === 'acceptedResults') {
      loadVendorRatings(data);
      loadFeedbackReceived(data);
    }
  }

  async function loadVendorRatings(shifts) {
    const vendorIds = [...new Set(
        shifts
            .filter(s => statusOf(s) === 'COMPLETED' && Number(s.vendorId) > 0)
            .map(s => Number(s.vendorId))
    )];

    for (const vendorId of vendorIds) {
      try {
        const summary = await GigsUp.api(
            `/api/reviews/users/${vendorId}/summary`
        );

        document.querySelectorAll(
            `.vendor-rating[data-vendor-rating="${vendorId}"]`
        ).forEach(el => {
          const average = Number(summary.averageRating || 0);
          const count = Number(summary.reviewCount || 0);

          el.textContent = count
              ? `⭐ ${average.toFixed(1)} / 5 (${count} review${count === 1 ? '' : 's'})`
              : '⭐ No ratings yet';
        });
      } catch {
        document.querySelectorAll(
            `.vendor-rating[data-vendor-rating="${vendorId}"]`
        ).forEach(el => {
          el.textContent = 'Vendor rating unavailable';
        });
      }
    }
  }

  // Display feedback vendors have left for this student on completed jobs.
  async function loadFeedbackReceived(shifts) {
    const completed = shifts.filter(s => statusOf(s) === 'COMPLETED');

    if (!completed.length) return;

    if (!Number.isInteger(studentId) || studentId <= 0) {
      completed.forEach(s => {
        const el = document.querySelector(
            `[data-job-feedback="${Number(s.id)}"]`
        );

        if (el) {
          el.textContent =
              'Feedback will appear here once your account ID is available.';
        }
      });
      return;
    }

    try {
      const reviews = await GigsUp.api(`/api/reviews/users/${studentId}`);

      for (const shift of completed) {
        const shiftId = Number(shift.id);
        const el = document.querySelector(
            `[data-job-feedback="${shiftId}"]`
        );

        if (!el) continue;

        const review = Array.isArray(reviews)
            ? reviews.find(r =>
                Number(r.shiftId ?? r.shift?.id) === shiftId
            )
            : null;

        if (!review) {
          el.textContent = 'No vendor feedback recorded for this job yet.';
          continue;
        }

        const rating = Number(review.rating || 0);
        const feedback = review.feedback || 'No written feedback provided.';

        el.innerHTML = `
          <p><strong>Vendor rating:</strong> ${'★'.repeat(
            Math.max(0, Math.min(5, rating))
        )}${'☆'.repeat(
            5 - Math.max(0, Math.min(5, rating))
        )} (${rating}/5)</p>
          <p><strong>Feedback:</strong> ${escape(feedback)}</p>
          <p class="muted">
            ${escape(review.createdAt ? GigsUp.date(review.createdAt) : '')}
          </p>
        `;
      }
    } catch {
      completed.forEach(s => {
        const el = document.querySelector(
            `[data-job-feedback="${Number(s.id)}"]`
        );

        if (el) {
          el.textContent = 'Could not load vendor feedback.';
        }
      });
    }
  }

  async function refresh() {
    GigsUp.clearMessage(msg);

    try {
      const [accepted, availability] = await Promise.all([
        GigsUp.api('/api/shifts/accepted'),
        GigsUp.api('/api/availability')
      ]);

      $('acceptedCount').textContent =
          Array.isArray(accepted) ? accepted.length : '—';

      $('availabilityCount').textContent =
          Array.isArray(availability) ? availability.length : '—';

      render('acceptedResults', accepted);

      $('availabilityResults').innerHTML =
          Array.isArray(availability) && availability.length
              ? availability.map(a => `
              <article class="shift-item">
                <div>
                  <h3>Availability window</h3>
                  <p>
                    ${escape(GigsUp.date(a.availableFrom))}
                    —
                    ${escape(GigsUp.date(a.availableTo))}
                  </p>
                </div>
              </article>
            `).join('')
              : '<div class="empty-state">No availability windows saved yet.</div>';
    } catch (error) {
      GigsUp.showMessage(msg, error.message);
    }
  }

  // Accept a matching shift.
  $('matchResults').addEventListener('click', async e => {
    const button = e.target.closest('.accept-shift');
    if (!button) return;

    const id = Number(button.dataset.shiftId);

    if (!Number.isInteger(id) || id <= 0) {
      GigsUp.showMessage(msg, 'Invalid shift ID.');
      return;
    }

    if (!confirm('Accept this shift?')) return;

    button.disabled = true;
    button.textContent = 'Accepting…';
    GigsUp.clearMessage(msg);

    try {
      await GigsUp.api(`/api/shifts/${id}/accept`, {
        method: 'POST'
      });

      GigsUp.showMessage(msg, 'Shift accepted successfully!', 'success');
      await refresh();
      await searchShifts();
    } catch (error) {
      GigsUp.showMessage(msg, error.message);
      button.disabled = false;
      button.textContent = 'Accept Shift';
    }
  });

  // Complete an accepted shift.
  $('acceptedResults').addEventListener('click', async e => {
    const button = e.target.closest('.complete-shift');
    if (!button) return;

    const id = Number(button.dataset.shiftId);

    if (!Number.isInteger(id) || id <= 0) {
      GigsUp.showMessage(msg, 'Invalid shift ID.');
      return;
    }

    if (!confirm('Mark this shift as completed?')) return;

    button.disabled = true;
    button.textContent = 'Completing…';
    GigsUp.clearMessage(msg);

    try {
      await GigsUp.api(`/api/shifts/${id}/complete`, {
        method: 'POST'
      });

      GigsUp.showMessage(msg, 'Shift completed successfully!', 'success');
      await refresh();
    } catch (error) {
      GigsUp.showMessage(msg, error.message);
      button.disabled = false;
      button.textContent = 'Complete Shift';
    }
  });

  // Open the Student → Vendor rating form.
  $('acceptedResults').addEventListener('click', e => {
    const button = e.target.closest('.rate-vendor');
    if (!button) return;

    const shiftId = Number(button.dataset.shiftId);
    const vendorId = Number(button.dataset.vendorId);
    const vendorName = button.dataset.vendorName || 'Vendor';

    if (
        !Number.isInteger(shiftId) || shiftId <= 0 ||
        !Number.isInteger(vendorId) || vendorId <= 0
    ) {
      GigsUp.showMessage(msg, 'Could not identify the shift or vendor.');
      return;
    }

    if (reviewedShifts.has(shiftId)) {
      GigsUp.showMessage(
          msg,
          'You have already submitted a review for this shift in this session.'
      );
      return;
    }

    const card = button.closest('.shift-item');
    if (!card || card.querySelector('.review-form')) return;

    const form = document.createElement('form');
    form.className = 'review-form';

    form.innerHTML = `
      <h3>Rate ${escape(vendorName)}</h3>

      <label for="review-rating-${shiftId}">Rating (1–5 stars)</label>
      <select id="review-rating-${shiftId}" name="rating" required>
        <option value="">Choose a rating</option>
        <option value="5">★★★★★ — Excellent</option>
        <option value="4">★★★★ — Good</option>
        <option value="3">★★★ — Average</option>
        <option value="2">★★ — Poor</option>
        <option value="1">★ — Very poor</option>
      </select>

      <label for="review-feedback-${shiftId}">Feedback (optional)</label>
      <textarea id="review-feedback-${shiftId}"
                name="feedback"
                maxlength="1000"
                rows="3"
                placeholder="Share your experience with this vendor"></textarea>

      <p class="review-error" role="alert"></p>

      <button class="btn btn-primary" type="submit">Submit review</button>
      <button class="btn btn-outline cancel-review" type="button">Cancel</button>
    `;

    card.appendChild(form);

    form.querySelector('.cancel-review').addEventListener('click', () => {
      form.remove();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const submitButton = form.querySelector('[type="submit"]');
      const errorEl = form.querySelector('.review-error');
      const rating = Number(form.elements.rating.value);
      const feedback = form.elements.feedback.value.trim();

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        errorEl.textContent = 'Please select a rating from 1 to 5.';
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Submitting…';
      errorEl.textContent = '';

      try {
        await GigsUp.api(`/api/reviews/shifts/${shiftId}`, {
          method: 'POST',
          body: JSON.stringify({ rating, feedback })
        });

        reviewedShifts.add(shiftId);
        form.remove();
        button.disabled = true;
        button.textContent = '✓ Review submitted';

        GigsUp.showMessage(
            msg,
            'Your review was submitted successfully!',
            'success'
        );

        const summary = await GigsUp.api(
            `/api/reviews/users/${vendorId}/summary`
        );

        const ratingEl = card.querySelector(
            `.vendor-rating[data-vendor-rating="${vendorId}"]`
        );

        if (ratingEl) {
          const average = Number(summary.averageRating || 0);
          const count = Number(summary.reviewCount || 0);

          ratingEl.textContent = count
              ? `⭐ ${average.toFixed(1)} / 5 (${count} review${count === 1 ? '' : 's'})`
              : '⭐ No ratings yet';
        }
      } catch (error) {
        errorEl.textContent = error.message || 'Could not submit the review.';
        submitButton.disabled = false;
        submitButton.textContent = 'Submit review';
      }
    });
  });

  async function searchShifts() {
    const lat = Number($('matchLat').value);
    const lng = Number($('matchLng').value);
    const radiusMeters = Number($('matchRadius').value);

    if (
        !Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lng) || lng < -180 || lng > 180 ||
        !Number.isFinite(radiusMeters) ||
        radiusMeters < 1 || radiusMeters > 100000
    ) {
      throw new Error(
          'Enter valid coordinates and a radius between 1 and 100000 meters.'
      );
    }

    const shifts = await GigsUp.api('/api/shifts/match', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, radiusMeters })
    });

    render('matchResults', shifts);
  }

  // Search for matching shifts.
  $('matchForm').addEventListener('submit', async e => {
    e.preventDefault();
    GigsUp.clearMessage(msg);

    try {
      await searchShifts();
      GigsUp.showMessage(msg, 'Shift search completed.', 'success');
    } catch (error) {
      GigsUp.showMessage(msg, error.message);
    }
  });

  // Save availability.
  $('availabilityForm').addEventListener('submit', async e => {
    e.preventDefault();
    GigsUp.clearMessage(msg);

    const from = new Date($('availableFrom').value);
    const to = new Date($('availableTo').value);

    if (!(from > new Date()) || !(to > from)) {
      GigsUp.showMessage(
          msg,
          'Choose a future start time and an end time after the start.'
      );
      return;
    }

    try {
      await GigsUp.api('/api/availability', {
        method: 'POST',
        body: JSON.stringify({
          availableFrom: from.toISOString(),
          availableTo: to.toISOString()
        })
      });

      GigsUp.showMessage(msg, 'Availability saved.', 'success');
      await refresh();
    } catch (error) {
      GigsUp.showMessage(msg, error.message);
    }
  });

  $('refreshStudent').addEventListener('click', refresh);

  refresh();
})();