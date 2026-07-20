package com.expressvraem.modules.empresa.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Entity
@Table(name = "empresa_config")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EmpresaConfig {

    @Id
    private Long id;  // siempre 1 (single-row table)

    @NotBlank(message = "El nombre de la empresa es obligatorio")
    @Size(max = 200)
    @Column(nullable = false, length = 200)
    private String nombre;

    @Pattern(regexp = "^$|^\\d{11}$", message = "El RUC debe tener exactamente 11 dígitos")
    @Column(length = 11)
    private String ruc;

    @Size(max = 300)
    @Column(length = 300)
    private String direccion;

    @Size(max = 200)
    @Column(length = 200)
    private String ciudad;

    @Size(max = 50)
    @Column(length = 50)
    private String telefono;

    // ~512 KB base64 ≈ ~384 KB imagen — suficiente para un logo
    @Size(max = 524288, message = "El logo no puede superar 512 KB en base64")
    @Column(name = "logo_base64", columnDefinition = "TEXT")
    private String logoBase64;

    /** Cuota fija que paga cada combi por salida. 0 = deshabilitado. */
    @DecimalMin(value = "0.00", message = "La cuota de salida no puede ser negativa")
    @Column(name = "cuota_salida_combi", precision = 8, scale = 2)
    private java.math.BigDecimal cuotaSalidaCombi;

    /** Cuota fija que paga cada camioneta por salida. 0 = deshabilitado. */
    @DecimalMin(value = "0.00", message = "La cuota de salida no puede ser negativa")
    @Column(name = "cuota_salida_camioneta", precision = 8, scale = 2)
    private java.math.BigDecimal cuotaSalidaCamioneta;

    /** Cuota de salida según el tipo de vehículo (null-safe, 0 si no aplica). */
    @Transient
    public java.math.BigDecimal cuotaSalidaPara(String tipoVehiculo) {
        java.math.BigDecimal c = "COMBI".equalsIgnoreCase(tipoVehiculo)
                ? cuotaSalidaCombi
                : "CAMIONETA".equalsIgnoreCase(tipoVehiculo) ? cuotaSalidaCamioneta : null;
        return c != null ? c : java.math.BigDecimal.ZERO;
    }
}
