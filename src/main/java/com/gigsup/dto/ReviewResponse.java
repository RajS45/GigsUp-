package com.gigsup.dto;

import com.gigsup.entity.Review;

import java.time.Instant;

public record ReviewResponse(
        Long id,
        Long shiftId,
        Long reviewerId,
        Long revieweeId,
        Integer rating,
        String feedback,
        Instant createdAt
) {
    public static ReviewResponse from(Review review) {
        return new ReviewResponse(
                review.getId(),
                review.getShift().getId(),
                review.getReviewer().getId(),
                review.getReviewee().getId(),
                review.getRating(),
                review.getFeedback(),
                review.getCreatedAt()
        );
    }
}