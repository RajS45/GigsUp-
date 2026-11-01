(() => {
 if (!GigsUp.requireRole('VENDOR')) return;

 const $ = id => document.getElementById(id);
 const msg = $('dashMessage');

 function escape(value) {
  return GigsUp.escape(value ?? '');
 }

 function getStudentId(shift) {
  return (
      shift.studentId ??
      shift.student?.id ??
      shift.assignedStudentId ??
      shift.acceptedBy?.id ??
      shift.acceptedById ??
      shift.student?.userId ??
      shift.assignedStudent?.id ??
      shift.acceptedStudent?.id ??
      ''
  );
 }

 function render(data) {
  const arr = Array.isArray(data) ? data : [];

  $('postedCount').textContent = arr.length;

  $('activeCount').textContent = arr.filter(shift =>
      ['OPEN', 'POSTED', 'ACTIVE'].includes(
          String(shift.status ?? '').toUpperCase()
      )
  ).length;

  $('completedCount').textContent = arr.filter(shift =>
      String(shift.status ?? '').toUpperCase() === 'COMPLETED'
  ).length;

  $('postedResults').innerHTML = arr.length
      ? arr.map(shift => {
       const status = String(shift.status ?? '').toUpperCase();
       const completed = status === 'COMPLETED';
       const shiftId = shift.id;
       const studentId = getStudentId(shift);

       return `
                    <article class="shift-item">
                        <div>
                            <h3>${escape(shift.title || 'Untitled shift')}</h3>

                            <p>${escape(
           shift.description || 'No description provided'
       )}</p>

                            <p>
                                ${escape(GigsUp.date(shift.startTime))}
                                –
                                ${escape(GigsUp.date(shift.endTime))}
                                · Location:
                                ${
           shift.lat != null &&
           Number.isFinite(Number(shift.lat))
               ? Number(shift.lat).toFixed(4)
               : 'N/A'
       },
                                ${
           shift.lng != null &&
           Number.isFinite(Number(shift.lng))
               ? Number(shift.lng).toFixed(4)
               : 'N/A'
       }
                            </p>

                            ${
           completed
               ? `
                                        <button
                                            type="button"
                                            class="profile-review-btn"
                                            data-shift-id="${escape(shiftId)}"
                                            data-student-id="${escape(studentId)}"
                                        >
                                            ⭐ Rate Student
                                        </button>

                                        <div
                                            class="vendor-review-form"
                                            id="vendor-review-${escape(shiftId)}"
                                            hidden
                                        >
                                            <label>
                                                Student rating
                                                <select class="vendor-rating">
                                                    <option value="5">5 - Excellent</option>
                                                    <option value="4">4 - Very good</option>
                                                    <option value="3">3 - Good</option>
                                                    <option value="2">2 - Fair</option>
                                                    <option value="1">1 - Poor</option>
                                                </select>
                                            </label>

                                            <label>
                                                Feedback
                                                <textarea
                                                    class="vendor-feedback"
                                                    maxlength="1000"
                                                    placeholder="Share your feedback about this student"
                                                ></textarea>
                                            </label>

                                            <button
                                                type="button"
                                                class="submit-vendor-review"
                                                data-shift-id="${escape(shiftId)}"
                                            >
                                                Submit review
                                            </button>

                                            <p
                                                class="review-form-message"
                                                aria-live="polite"
                                            ></p>
                                        </div>
                                    `
               : ''
       }
                        </div>

                        <div class="shift-meta">
                            <span class="shift-pay">
                                ${escape(GigsUp.money(shift.payRate))}
                            </span>

                            <span class="shift-status">
                                ${escape(shift.status || 'UNKNOWN')}
                            </span>
                        </div>
                    </article>
                `;
      }).join('')
      : `
                <div class="empty-state">
                    No posted shifts found yet. Use the form above to post your first shift.
                </div>
            `;
 }

 async function refresh() {
  GigsUp.clearMessage(msg);

  try {
   const data = await GigsUp.api('/api/shifts/posted');
   render(data);
  } catch (error) {
   GigsUp.showMessage(msg, error.message);

   $('postedResults').innerHTML = `
                <div class="empty-state">
                    Could not load shifts. Check your session and backend.
                </div>
            `;
  }
 }

 // Post a new shift.
 $('postShiftForm').addEventListener('submit', async event => {
  event.preventDefault();
  GigsUp.clearMessage(msg);

  const start = new Date($('startTime').value);
  const end = new Date($('endTime').value);

  if (!(start > new Date()) || !(end > start)) {
   GigsUp.showMessage(
       msg,
       'Choose a future start time and an end time after the start.'
   );
   return;
  }

  const payload = {
   title: $('shiftTitle').value.trim(),
   description: $('shiftDescription').value.trim(),
   payRate: Number($('payRate').value),
   lat: Number($('vendorLat').value),
   lng: Number($('vendorLng').value),
   startTime: start.toISOString(),
   endTime: end.toISOString()
  };

  const button = event.submitter;

  if (button) {
   button.disabled = true;
   button.textContent = 'Posting…';
  }

  try {
   await GigsUp.api('/api/shifts', {
    method: 'POST',
    body: JSON.stringify(payload)
   });

   GigsUp.showMessage(
       msg,
       'Shift posted successfully.',
       'success'
   );

   $('postShiftForm').reset();
   await refresh();
  } catch (error) {
   GigsUp.showMessage(msg, error.message);
  } finally {
   if (button) {
    button.disabled = false;
    button.textContent = '＋ Post shift';
   }
  }
 });

 // Handle review form opening and submission.
 $('postedResults').addEventListener('click', async event => {
  const reviewButton = event.target.closest('.profile-review-btn');

  if (reviewButton) {
   const shiftId = reviewButton.dataset.shiftId;
   const studentId = reviewButton.dataset.studentId;

   if (!studentId) {
    GigsUp.showMessage(
        msg,
        'Student ID is missing from this completed shift.'
    );
    return;
   }

   const form = $(`vendor-review-${shiftId}`);

   if (form) {
    form.hidden = !form.hidden;
   }

   return;
  }

  const submitButton = event.target.closest('.submit-vendor-review');

  if (!submitButton || submitButton.disabled) return;

  const shiftId = submitButton.dataset.shiftId;
  const form = $(`vendor-review-${shiftId}`);

  if (!form) {
   GigsUp.showMessage(msg, 'Review form could not be found.');
   return;
  }

  const ratingInput = form.querySelector('.vendor-rating');
  const feedbackInput = form.querySelector('.vendor-feedback');
  const formMessage = form.querySelector('.review-form-message');

  // Ensure the form has all the elements needed by the handler.
  if (!ratingInput || !feedbackInput || !formMessage) {
   console.error('Review form is missing a required element.', {
    shiftId,
    ratingInput: !!ratingInput,
    feedbackInput: !!feedbackInput,
    formMessage: !!formMessage
   });

   GigsUp.showMessage(
       msg,
       'Review form is incomplete. Refresh the page and try again.'
   );
   return;
  }

  const rating = Number(ratingInput.value);
  const feedback = feedbackInput.value.trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
   formMessage.textContent = 'Please select a rating from 1 to 5.';
   formMessage.style.color = '#dc2626';
   return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Submitting…';
  formMessage.textContent = '';

  try {
   await GigsUp.api(
       `/api/reviews/shifts/${encodeURIComponent(shiftId)}`,
       {
        method: 'POST',
        body: JSON.stringify({
         rating,
         feedback
        })
       }
   );

   formMessage.textContent = 'Review submitted successfully!';
   formMessage.style.color = '#16a34a';

   submitButton.textContent = 'Review submitted';

   ratingInput.disabled = true;
   feedbackInput.disabled = true;

   reviewButton.textContent = '✓ Review submitted';
   reviewButton.disabled = true;
  } catch (error) {
   console.error('Review submission failed:', error);

   formMessage.textContent =
       error.message || 'Could not submit review.';
   formMessage.style.color = '#dc2626';

   submitButton.disabled = false;
   submitButton.textContent = 'Submit review';
  }
 });

 $('refreshVendor').addEventListener('click', refresh);

 refresh();
})();