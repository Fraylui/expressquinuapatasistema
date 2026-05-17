package com.expressvraem.modules.encomiendas.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record RegistrarEncomiendaDTO(

        /* ── Remitente inline ────────────────────────── */
        @NotBlank(message = "Tipo doc remitente obligatorio")
        String remitenteTipoDoc,

        @NotBlank(message = "Doc remitente obligatorio")
        String remitenteDoc,

        String remitenteNombres,
        String remitenteApellidos,
        String remitenteRazonSocial,
        String remitenteTelefono,

        /* ── Destinatario inline ─────────────────────── */
        @NotBlank(message = "Tipo doc destinatario obligatorio")
        String destinatarioTipoDoc,

        @NotBlank(message = "Doc destinatario obligatorio")
        String destinatarioDoc,

        String destinatarioNombres,
        String destinatarioApellidos,
        String destinatarioRazonSocial,
        String destinatarioTelefono,

        /* ── Paquete ─────────────────────────────────── */
        @NotBlank(message = "La descripción es obligatoria")
        @Size(max = 255)
        String descripcion,

        @Positive
        @DecimalMax("9999.99")
        BigDecimal pesoKg,

        Long viajeId,

        @NotNull(message = "La agencia destino es obligatoria")
        Long agenciaDestinoId,

        /* ── Cobro ───────────────────────────────────── */
        @NotNull(message = "El monto es obligatorio")
        @DecimalMin("0.00")
        BigDecimal monto,

        @NotBlank(message = "La forma de cobro es obligatoria")
        @Pattern(regexp = "^(EFECTIVO|TRANSFERENCIA|YAPE|PLIN|POR_COBRAR)$",
                message = "Forma de cobro inválida")
        String formaCobro,

        /* ── Extras ──────────────────────────────────── */
        @Size(max = 500)
        String observaciones

) {}
