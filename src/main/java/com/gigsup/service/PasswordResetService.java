package com.gigsup.service;
import com.gigsup.dto.ForgotPasswordRequest;
import com.gigsup.dto.ResetPasswordRequest;
import com.gigsup.entity.PasswordResetOtp;
import com.gigsup.entity.User;
import com.gigsup.exception.ApiException;
import com.gigsup.repository.PasswordResetOtpRepository;
import com.gigsup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final PasswordResetOtpRepository resetOtpRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private final SecureRandom random = new SecureRandom();

    @Transactional
    public void requestReset(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(
                        "If this email is registered, a reset OTP will be generated.",
                        HttpStatus.OK
                ));

        String otp = String.format("%06d", random.nextInt(1_000_000));
        Instant now = Instant.now();

        PasswordResetOtp resetOtp = resetOtpRepository
                .findByEmail(email)
                .orElseGet(PasswordResetOtp::new);

        resetOtp.setEmail(email);
        resetOtp.setOtpHash(passwordEncoder.encode(otp));
        resetOtp.setExpiresAt(now.plusSeconds(300));
        resetOtp.setAttempts(0);
        resetOtp.setCreatedAt(now);

        resetOtpRepository.save(resetOtp);

        // Development only. Replace with secure email/SMS delivery in production.
        System.out.println("[DEV PASSWORD RESET OTP] Email: "
                + user.getEmail() + " | OTP: " + otp);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public void resetPassword(ResetPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);

        PasswordResetOtp resetOtp = resetOtpRepository
                .findByEmail(email)
                .orElseThrow(() -> new ApiException(
                        "Invalid or expired reset OTP. Request a new one.",
                        HttpStatus.BAD_REQUEST
                ));

        if (resetOtp.getExpiresAt().isBefore(Instant.now())) {
            resetOtpRepository.delete(resetOtp);
            throw new ApiException(
                    "Reset OTP expired. Request a new one.",
                    HttpStatus.BAD_REQUEST
            );
        }

        if (resetOtp.getAttempts() >= 5) {
            resetOtpRepository.delete(resetOtp);
            throw new ApiException(
                    "Too many attempts. Request a new reset OTP.",
                    HttpStatus.TOO_MANY_REQUESTS
            );
        }

        resetOtp.setAttempts(resetOtp.getAttempts() + 1);

        if (!passwordEncoder.matches(request.getOtp(), resetOtp.getOtpHash())) {
            resetOtpRepository.save(resetOtp);
            throw new ApiException(
                    "Invalid reset OTP.",
                    HttpStatus.BAD_REQUEST
            );
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(
                        "User not found.",
                        HttpStatus.NOT_FOUND
                ));

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        resetOtpRepository.delete(resetOtp);
    }
}
