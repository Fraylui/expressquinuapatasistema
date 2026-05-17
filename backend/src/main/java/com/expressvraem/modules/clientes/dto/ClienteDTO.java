package com.expressvraem.modules.clientes.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class ClienteDTO {

    @NotBlank
    @Size(max = 80)
    private String nombres;

    @NotBlank
    @Size(max = 80)
    private String apellidos;

    @NotBlank
    @Pattern(regexp = "^(DNI|CE|PASAPORTE|RUC)$", message = "Tipo de documento inválido")
    private String tipoDoc;

    @NotBlank
    @Size(max = 20)
    private String numDoc;

    private String telefono;

    @Size(max = 100)
    private String email;

    private LocalDate fechaNac;

    /** OWASP A03 + Ley 29733: valida formato según tipo de documento peruano */
    @AssertTrue(message = "Número de documento inválido para el tipo seleccionado")
    public boolean isNumDocValido() {
        if (tipoDoc == null || numDoc == null) return true;
        return switch (tipoDoc) {
            case "DNI"      -> numDoc.matches("^\\d{8}$");
            case "RUC"      -> numDoc.matches("^(10|20)\\d{9}$");
            case "CE"       -> numDoc.matches("^[A-Z0-9]{6,12}$");
            case "PASAPORTE"-> numDoc.matches("^[A-Z0-9]{6,15}$");
            default         -> true;
        };
    }
}
