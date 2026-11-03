package com.gigsup.service;

import com.gigsup.dto.ShiftMatchRequest;
import com.gigsup.dto.ShiftRequest;
import com.gigsup.entity.Shift;
import com.gigsup.entity.User;
import com.gigsup.enums.Role;
import com.gigsup.enums.ShiftStatus;
import com.gigsup.exception.ApiException;
import com.gigsup.repository.ShiftRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ShiftService {

    private final ShiftRepository shiftRepository;
    private final CurrentUserService currentUserService;
    private final GeoUtil geoUtil;

    // VENDOR: Post a new shift
    @Transactional
    public Shift postShift(ShiftRequest req) {

        User vendor = currentUserService.getCurrentUser();

        if (vendor.getRole() != Role.VENDOR) {
            throw new ApiException(
                    "Only vendors can post shifts",
                    HttpStatus.FORBIDDEN
            );
        }

        if (!req.getStartTime().isBefore(req.getEndTime())) {
            throw new ApiException(
                    "Shift start time must be before end time",
                    HttpStatus.BAD_REQUEST
            );
        }

        Shift shift = Shift.builder()
                .vendor(vendor)
                .title(req.getTitle())
                .description(req.getDescription())
                .payRate(req.getPayRate())
                .location(geoUtil.toPoint(req.getLat(), req.getLng()))
                .startTime(req.getStartTime())
                .endTime(req.getEndTime())
                .status(ShiftStatus.OPEN)
                .build();

        return shiftRepository.save(shift);
    }

    // STUDENT: Find nearby matching shifts
    @Transactional(readOnly = true)
    public List<Shift> findMatches(ShiftMatchRequest req) {

        User student = currentUserService.getCurrentUser();

        if (student.getRole() != Role.STUDENT) {
            throw new ApiException(
                    "Only students can search for matching shifts",
                    HttpStatus.FORBIDDEN
            );
        }

        return shiftRepository.findMatchingShifts(
                req.getLat(),
                req.getLng(),
                req.getRadiusMeters()
        );
    }

    // STUDENT: Accept an available shift
    @Transactional
    public Shift acceptShift(Long id) {

        User student = currentUserService.getCurrentUser();

        if (student.getRole() != Role.STUDENT) {
            throw new ApiException(
                    "Only students can accept shifts",
                    HttpStatus.FORBIDDEN
            );
        }

        Shift shift = shiftRepository.findById(id)
                .orElseThrow(() -> new ApiException(
                        "Shift not found",
                        HttpStatus.NOT_FOUND
                ));

        if (shift.getStatus() != ShiftStatus.OPEN) {
            throw new ApiException(
                    "Shift is no longer available",
                    HttpStatus.CONFLICT
            );
        }

        shift.setStudent(student);
        shift.setStatus(ShiftStatus.MATCHED);

        return shiftRepository.save(shift);
    }

    // VENDOR: Complete a matched shift
    @Transactional
    public Shift completeShift(Long id) {

        User user = currentUserService.getCurrentUser();

        // Only vendors can complete shifts
        if (user.getRole() != Role.VENDOR) {
            throw new ApiException(
                    "Only vendors can complete shifts",
                    HttpStatus.FORBIDDEN
            );
        }

        Shift shift = shiftRepository.findById(id)
                .orElseThrow(() -> new ApiException(
                        "Shift not found",
                        HttpStatus.NOT_FOUND
                ));

        // Only the owning vendor can complete the shift
        if (!shift.getVendor().getId().equals(user.getId())) {
            throw new ApiException(
                    "You are not authorized to complete this shift",
                    HttpStatus.FORBIDDEN
            );
        }

        // Shift must be matched before completion
        if (shift.getStatus() != ShiftStatus.MATCHED) {
            throw new ApiException(
                    "Only matched shifts can be completed",
                    HttpStatus.BAD_REQUEST
            );
        }

        shift.setStatus(ShiftStatus.COMPLETED);

        return shiftRepository.save(shift);
    }

    // VENDOR: View posted shifts
    @Transactional(readOnly = true)
    public List<Shift> myPostedShifts() {

        User vendor = currentUserService.getCurrentUser();

        if (vendor.getRole() != Role.VENDOR) {
            throw new ApiException(
                    "Only vendors can view posted shifts",
                    HttpStatus.FORBIDDEN
            );
        }

        return shiftRepository.findByVendorId(vendor.getId());
    }

    // STUDENT: View accepted shifts
    @Transactional(readOnly = true)
    public List<Shift> myAcceptedShifts() {

        User student = currentUserService.getCurrentUser();

        if (student.getRole() != Role.STUDENT) {
            throw new ApiException(
                    "Only students can view accepted shifts",
                    HttpStatus.FORBIDDEN
            );
        }

        return shiftRepository.findByStudentId(student.getId());
    }
}