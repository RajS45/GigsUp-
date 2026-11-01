package com.gigsup.repository;

import com.gigsup.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    List<Review> findByReviewee_IdOrderByCreatedAtDesc(Long revieweeId);

    List<Review> findByShift_Id(Long shiftId);

    boolean existsByShift_IdAndReviewer_IdAndReviewee_Id(
            Long shiftId,
            Long reviewerId,
            Long revieweeId
    );

    @Query("""
        SELECT AVG(r.rating)
        FROM Review r
        WHERE r.reviewee.id = :revieweeId
    """)
    Double findAverageRatingByRevieweeId(
            @Param("revieweeId") Long revieweeId
    );

    @Query("""
        SELECT COUNT(r)
        FROM Review r
        WHERE r.reviewee.id = :revieweeId
    """)
    long countReviewsByRevieweeId(
            @Param("revieweeId") Long revieweeId
    );
}