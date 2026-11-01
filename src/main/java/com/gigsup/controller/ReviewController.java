package com.gigsup.controller;

import com.gigsup.dto.ReviewResponse;
import com.gigsup.dto.ReviewSummaryResponse;
import com.gigsup.entity.Review;
import com.gigsup.service.ReviewService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping("/shifts/{shiftId}")
    public ResponseEntity<ReviewResponse> submitReview(
            @PathVariable Long shiftId,
            @Valid @RequestBody ReviewRequest request
    ) {
        Review review = reviewService.submitReview(
                shiftId,
                request.getRating(),
                request.getFeedback()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ReviewResponse.from(review));
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<List<ReviewResponse>> getUserReviews(
            @PathVariable Long userId
    ) {
        List<ReviewResponse> reviews = reviewService
                .getReviewsForUser(userId)
                .stream()
                .map(ReviewResponse::from)
                .toList();

        return ResponseEntity.ok(reviews);
    }

    @GetMapping("/users/{userId}/summary")
    public ResponseEntity<ReviewSummaryResponse> getUserRatingSummary(
            @PathVariable Long userId
    ) {
        ReviewSummaryResponse summary = new ReviewSummaryResponse(
                userId,
                reviewService.getAverageRating(userId),
                reviewService.getReviewCount(userId)
        );

        return ResponseEntity.ok(summary);
    }

    @Data
    public static class ReviewRequest {

        @NotNull(message = "Rating is required")
        @Min(value = 1, message = "Rating must be at least 1")
        @Max(value = 5, message = "Rating cannot exceed 5")
        private Integer rating;

        @Size(
                max = 1000,
                message = "Feedback cannot exceed 1000 characters"
        )
        private String feedback;
    }
}