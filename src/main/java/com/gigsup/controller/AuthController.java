package com.gigsup.controller;

import com.gigsup.dto.AuthResponse;
import com.gigsup.dto.ForgotPasswordRequest;
import com.gigsup.dto.LoginRequest;
import com.gigsup.dto.OtpVerifyRequest;
import com.gigsup.dto.RegisterRequest;
import com.gigsup.dto.RegistrationResponse;
import com.gigsup.dto.ResetPasswordRequest;
import com.gigsup.service.AuthService;
import com.gigsup.service.PasswordResetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    public RegistrationResponse register(
            @Valid @RequestBody RegisterRequest req
    ) {
        return authService.register(req);
    }

    @PostMapping("/verify-phone")
    public RegistrationResponse verifyPhone(
            @Valid @RequestBody OtpVerifyRequest req
    ) {
        return authService.verifyPhone(
                req.getPhoneNumber(),
                req.getOtp()
        );
    }

    @PostMapping("/resend-otp")
    public RegistrationResponse resendOtp(
            @RequestParam String phoneNumber
    ) {
        return authService.resendOtp(phoneNumber);
    }

    @PostMapping("/login")
    public AuthResponse login(
            @Valid @RequestBody LoginRequest req
    ) {
        return authService.login(req);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<String> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest req
    ) {
        passwordResetService.requestReset(req);

        return ResponseEntity.ok(
                "If this email is registered, a password reset OTP has been generated."
        );
    }

    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(
            @Valid @RequestBody ResetPasswordRequest req
    ) {
        passwordResetService.resetPassword(req);

        return ResponseEntity.ok(
                "Password reset successful. You can now log in."
        );
    }
}
