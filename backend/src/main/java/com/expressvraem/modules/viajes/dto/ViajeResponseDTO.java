package com.expressvraem.modules.viajes.dto;

import com.expressvraem.modules.viajes.entity.Viaje;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
public class ViajeResponseDTO {

    private Long id;
    private Long agenciaId;
    private String estado;
    private OffsetDateTime fechaHoraSal;
    private OffsetDateTime fechaHoraArr;
    private String observaciones;

    private RutaDTO     ruta;
    private VehiculoDTO vehiculo;

    private Long    conductorId;
    private String  conductorNombre;
    private Long    asientosLibres;
    private Long    asientosOcupados;
    private Long    cantEncomiendas;

    /** Suma de ingresos en caja vinculados a este viaje (pasajes + encomiendas + cuota combi). */
    private java.math.BigDecimal ingresosViaje;

    @Data
    public static class RutaDTO {
        private Long   id;
        private String origen;
        private String destino;
        private Double distanciaKm;
    }

    @Data
    public static class VehiculoDTO {
        private Long    id;
        private String  placa;
        private String  tipo;
        private Integer numAsientos;
    }

    public static ViajeResponseDTO from(Viaje v,
                                        String origen, String destino, Double distanciaKm, Long rutaId,
                                        String placa, String tipo, Integer numAsientos, Long vehiculoId) {
        ViajeResponseDTO dto = new ViajeResponseDTO();
        dto.setId(v.getId());
        dto.setAgenciaId(v.getAgenciaId());
        dto.setEstado(v.getEstado());
        dto.setFechaHoraSal(v.getFechaHoraSal());
        dto.setFechaHoraArr(v.getFechaHoraArr());
        dto.setObservaciones(v.getObservaciones());

        RutaDTO ruta = new RutaDTO();
        ruta.setId(rutaId);
        ruta.setOrigen(origen);
        ruta.setDestino(destino);
        ruta.setDistanciaKm(distanciaKm);
        dto.setRuta(ruta);

        VehiculoDTO veh = new VehiculoDTO();
        veh.setId(vehiculoId);
        veh.setPlaca(placa);
        veh.setTipo(tipo);
        veh.setNumAsientos(numAsientos);
        dto.setVehiculo(veh);

        return dto;
    }
}
