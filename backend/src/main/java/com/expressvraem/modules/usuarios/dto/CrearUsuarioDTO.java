package com.expressvraem.modules.usuarios.dto;

import jakarta.validation.constraints.*;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

public record CrearUsuarioDTO(
        @NotBlank(message = "Nombres obligatorio")
        String nombres,

        @NotBlank(message = "Apellidos obligatorio")
        String apellidos,

        @NotBlank(message = "Email obligatorio")
        @Email(message = "Email inválido")
        String email,

        @NotBlank(message = "DNI obligatorio")
        @Size(min = 8, max = 8, message = "DNI debe tener 8 dígitos")
        @Pattern(regexp = "\\d{8}", message = "DNI debe tener 8 dígitos numéricos")
        String dni,

        @NotBlank(message = "Teléfono obligatorio")
        @Pattern(regexp = "9\\d{8}", message = "Teléfono debe tener 9 dígitos y empezar con 9")
        String telefono,

        @NotBlank(message = "Contraseña obligatoria")
        @Size(min = 8, message = "Contraseña mínimo 8 caracteres")
        String password,

        @NotBlank(message = "Rol obligatorio")
        @Pattern(regexp = "^(SUPER_ADMIN|GERENTE|ADMIN_AGENCIA|OPERADOR|CONDUCTOR)$",
                message = "Rol inválido")
        String rol,

        /**
         * Opcional para GERENTE y CONDUCTOR (trabajan con toda la empresa).
         * Obligatoria para ADMIN_AGENCIA y OPERADOR (se valida en el servicio).
         */
        Long agenciaId,

        // ── Datos de conductor (solo cuando rol = CONDUCTOR) ────────────────
        @Size(max = 20)
        String licencia,

        @Pattern(
            regexp = "^(A-I|A-IIa|A-IIb|A-IIIa|A-IIIb|A-IIIc|B-I|B-IIa|B-IIb|B-IIc)$",
            message = "Categoría inválida. Valores permitidos: A-I, A-IIa, A-IIb, A-IIIa, A-IIIb, A-IIIc, B-I, B-IIa, B-IIb, B-IIc"
        )
        String categoriaLic,

        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate fechaVencLic
) {}
