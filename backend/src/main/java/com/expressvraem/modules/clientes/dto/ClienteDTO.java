package com.expressvraem.modules.clientes.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class ClienteDTO {

    @Pattern(regexp = "^(PERSONA|EMPRESA)$", message = "Tipo debe ser PERSONA o EMPRESA")
    private String tipo;

    @Size(max = 200)
    private String razonSocial;

    @Size(max = 80)
    private String nombres;

    @Size(max = 80)
    private String apellidos;

    @Pattern(regexp = "^(DNI|CE|PASAPORTE|RUC)$", message = "Tipo de documento inválido")
    private String tipoDoc;

    @Size(max = 20)
    private String numDoc;

    private String telefono;

    @Size(max = 100)
    private String email;

    /** DNI del representante/contacto — solo para tipo EMPRESA */
    @Size(max = 8)
    private String dniContacto;

    private LocalDate fechaNac;

    private String direccion;

    public boolean isEmpresa() {
        return "EMPRESA".equals(tipo) || "RUC".equals(tipoDoc);
    }

    /** Valida campos obligatorios según tipo de entidad */
    @AssertTrue(message = "Para persona: nombres y apellidos son obligatorios. Para empresa: razón social es obligatoria")
    public boolean isDatosCompletos() {
        if (tipoDoc == null && tipo == null) return true;
        if (isEmpresa()) {
            return razonSocial != null && !razonSocial.isBlank()
                    && numDoc != null && !numDoc.isBlank();
        }
        return nombres != null && !nombres.isBlank()
                && apellidos != null && !apellidos.isBlank()
                && numDoc != null && !numDoc.isBlank();
    }

    /** OWASP A03 + Ley 29733: valida formato según tipo de documento peruano */
    @AssertTrue(message = "Número de documento inválido para el tipo seleccionado")
    public boolean isNumDocValido() {
        if (tipoDoc == null || numDoc == null) return true;
        return switch (tipoDoc) {
            case "DNI"       -> numDoc.matches("^\\d{8}$");
            case "RUC"       -> numDoc.matches("^(10|20)\\d{9}$");
            case "CE"        -> numDoc.matches("^[A-Z0-9]{6,12}$");
            case "PASAPORTE" -> numDoc.matches("^[A-Z0-9]{6,15}$");
            default          -> true;
        };
    }
}
