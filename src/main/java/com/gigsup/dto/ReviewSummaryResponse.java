package com.gigsup.dto;

public record ReviewSummaryResponse(
        Long userId,
        Double averageRating,
        long reviewCount
) {
}