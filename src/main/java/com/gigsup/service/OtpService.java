package com.gigsup.service;

import com.gigsup.entity.OtpVerification;
import com.gigsup.entity.User;
import com.gigsup.exception.ApiException;
import com.gigsup.repository.OtpVerificationRepository;
import com.gigsup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class OtpService {

    private final OtpVerificationRepository otpRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private final SecureRandom random = new SecureRandom();

    @Transactional
    public void generateOtp(User user) {
        String phone = user.getPhoneNumber();
        Instant now = Instant.now();

        String otp = String.format(
                "%06d",
                random.nextInt(1_000_000)
        );

        // Reuse the existing OTP record for this phone number.
        OtpVerification verification = otpRepository
                .findByPhoneNumber(phone)
                .orElseGet(() -> OtpVerification.builder()
                        .userId(user.getId())
                        .phoneNumber(phone)
                        .build());

        verification.setUserId(user.getId());
        verification.setPhoneNumber(phone);
        verification.setOtpHash(passwordEncoder.encode(otp));
        verification.setExpiresAt(now.plusSeconds(300));
        verification.setAttempts(0);
        verification.setVerified(false);
        verification.setCreatedAt(now);

        otpRepository.save(verification);

        // Development-only mock SMS. Never log OTPs in production.
        System.out.println(
                "[DEV MOCK SMS] Phone: " + phone + " | OTP: " + otp
        );
    }

    @Transactional(noRollbackFor = ApiException.class)
    public void verifyOtp(String phoneNumber, String otp) {

        OtpVerification verification = otpRepository
                .findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new ApiException(
                        "OTP not found. Request a new OTP.",
                        HttpStatus.BAD_REQUEST
                ));

        if (verification.isVerified()) {
            throw new ApiException(
                    "Phone number is already verified.",
                    HttpStatus.BAD_REQUEST
            );
        }

        if (verification.getExpiresAt().isBefore(Instant.now())) {
            otpRepository.delete(verification);

            throw new ApiException(
                    "OTP expired. Please request a new OTP.",
                    HttpStatus.BAD_REQUEST
            );
        }

        if (verification.getAttempts() >= 5) {
            otpRepository.delete(verification);

            throw new ApiException(
                    "Too many attempts. Please request a new OTP.",
                    HttpStatus.TOO_MANY_REQUESTS
            );
        }

        verification.setAttempts(verification.getAttempts() + 1);

        if (!passwordEncoder.matches(otp, verification.getOtpHash())) {
            otpRepository.save(verification);

            throw new ApiException(
                    "Invalid OTP.",
                    HttpStatus.BAD_REQUEST
            );
        }

        User user = userRepository.findById(verification.getUserId())
                .orElseThrow(() -> new ApiException(
                        "User not found.",
                        HttpStatus.NOT_FOUND
                ));

        user.setPhoneVerified(true);
        userRepository.save(user);

        verification.setVerified(true);
        otpRepository.save(verification);
    }
}
