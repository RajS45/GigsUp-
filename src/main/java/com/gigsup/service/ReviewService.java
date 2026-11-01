package com.gigsup.service;

import com.gigsup.entity.Review;
import com.gigsup.entity.Shift;
import com.gigsup.entity.User;
import com.gigsup.enums.Role;
import com.gigsup.enums.ShiftStatus;
import com.gigsup.exception.ApiException;
import com.gigsup.repository.ReviewRepository;
import com.gigsup.repository.ShiftRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ShiftRepository shiftRepository;
    private final CurrentUserService currentUserService;

    @Transactional
    public Review submitReview(
            Long shiftId,
            Integer rating,
            String feedback
    ) {
        User reviewer = currentUserService.getCurrentUser();

        if (rating == null || rating < 1 || rating > 5) {
            throw new ApiException(
                    "Rating must be between 1 and 5",
                    HttpStatus.BAD_REQUEST
            );
        }

        if (feedback != null && feedback.length() > 1000) {
            throw new ApiException(
                    "Feedback cannot exceed 1000 characters",
                    HttpStatus.BAD_REQUEST
            );
        }

        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new ApiException(
                        "Shift not found",
                        HttpStatus.NOT_FOUND
                ));

        if (shift.getStatus() != ShiftStatus.COMPLETED) {
            throw new ApiException(
                    "Reviews are allowed only for completed shifts",
                    HttpStatus.BAD_REQUEST
            );
        }

        User reviewee;

        if (reviewer.getRole() == Role.VENDOR
                && shift.getVendor().getId().equals(reviewer.getId())) {

            if (shift.getStudent() == null) {
                throw new ApiException(
                        "No student is assigned to this shift",
                        HttpStatus.BAD_REQUEST
                );
            }

            reviewee = shift.getStudent();

        } else if (reviewer.getRole() == Role.STUDENT
                && shift.getStudent() != null
                && shift.getStudent().getId().equals(reviewer.getId())) {

            reviewee = shift.getVendor();

        } else {
            throw new ApiException(
                    "Only the vendor and assigned student can review each other",
                    HttpStatus.FORBIDDEN
            );
        }

        boolean alreadyReviewed =
                reviewRepository.existsByShift_IdAndReviewer_IdAndReviewee_Id(
                        shiftId,
                        reviewer.getId(),
                        reviewee.getId()
                );

        if (alreadyReviewed) {
            throw new ApiException(
                    "You have already reviewed this user for this shift",
                    HttpStatus.CONFLICT
            );
        }

        Review review = new Review(
                shift,
                reviewer,
                reviewee,
                rating,
                feedback == null || feedback.isBlank()
                        ? null
                        : feedback.trim()
        );

        return reviewRepository.save(review);
    }

    @Transactional(readOnly = true)
    public List<Review> getReviewsForUser(Long userId) {
        return reviewRepository
                .findByReviewee_IdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public Double getAverageRating(Long userId) {
        Double average =
                reviewRepository.findAverageRatingByRevieweeId(userId);

        return average == null ? 0.0 : average;
    }

    @Transactional(readOnly = true)
    public long getReviewCount(Long userId) {
        return reviewRepository.countReviewsByRevieweeId(userId);
    }
}
